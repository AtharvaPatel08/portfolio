import { ScrollAnimator } from "./animator";
import { clamp, defaultEasing } from "./math";
import { VirtualScroll, type VirtualScrollPayload } from "./virtual-scroll";

export interface SmoothScrollOptions {
  lerp?: number;
  duration?: number;
  easing?: (t: number) => number;
  wheelMultiplier?: number;
  smoothWheel?: boolean;
  anchors?: boolean;
  anchorOffset?: number;
  allowNestedScroll?: boolean;
  respectReducedMotion?: boolean;
  prevent?: (node: HTMLElement, event: WheelEvent) => boolean;
}

export interface ScrollToOptions {
  offset?: number;
  duration?: number;
  easing?: (t: number) => number;
  lerp?: number;
  immediate?: boolean;
  lock?: boolean;
  force?: boolean;
  onComplete?: () => void;
}

export interface SmoothScrollSnapshot {
  scroll: number;
  targetScroll: number;
  limit: number;
  progress: number;
  velocity: number;
  direction: -1 | 0 | 1;
  isScrolling: "smooth" | "native" | false;
  isStopped: boolean;
  prefersReducedMotion: boolean;
}

type ScrollSubscriber = (snapshot: SmoothScrollSnapshot) => void;

function getElementScrollMarginTop(element: HTMLElement): number {
  const raw = window.getComputedStyle(element).scrollMarginTop;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Core Lenis-inspired smooth scrolling engine tailored for React 19 + Vite.
 * Wraps native window scroll so position: sticky, accessibility, and scroll choreography stay intact.
 */
export class SmoothScrollEngine {
  private animator = new ScrollAnimator();
  private virtualScroll: VirtualScroll | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private reducedMotionQuery: MediaQueryList | null = null;
  private subscribers = new Set<ScrollSubscriber>();

  private rafId = 0;
  private lastTime = 0;
  private isLocked = false;
  private onCompleteCallback?: () => void;
  private nativeScrollResetTimer = 0;
  private initialHashTimer = 0;

  // Options
  private readonly lerpFactor: number;
  private readonly defaultDuration: number;
  private readonly defaultEasingFn: (t: number) => number;
  private readonly smoothWheel: boolean;
  private readonly anchors: boolean;
  private readonly anchorOffset: number;
  private readonly respectReducedMotion: boolean;

  // Live scroll state
  actualScroll = 0;
  animatedScroll = 0;
  targetScroll = 0;
  limit = 0;
  velocity = 0;
  direction: -1 | 0 | 1 = 0;
  isScrolling: "smooth" | "native" | false = false;
  isStopped = false;
  private _prefersReducedMotion = false;
  private prevProgrammaticScroll = 0;
  private lastProgrammaticScroll = 0;

  private snapshot: SmoothScrollSnapshot;

  constructor(options: SmoothScrollOptions = {}) {
    this.lerpFactor = options.lerp ?? 0.1;
    this.defaultDuration = options.duration ?? 1.1;
    this.defaultEasingFn = options.easing ?? defaultEasing;
    this.smoothWheel = options.smoothWheel ?? true;
    this.anchors = options.anchors ?? true;
    this.anchorOffset = options.anchorOffset ?? 0;
    this.respectReducedMotion = options.respectReducedMotion ?? true;

    this.actualScroll = window.scrollY;
    this.animatedScroll = this.actualScroll;
    this.targetScroll = this.actualScroll;
    this.prevProgrammaticScroll = this.actualScroll;
    this.lastProgrammaticScroll = this.actualScroll;
    this.limit = this.computeLimit();

    if (typeof window !== "undefined" && "matchMedia" in window) {
      this.reducedMotionQuery = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );
      this._prefersReducedMotion =
        this.respectReducedMotion && this.reducedMotionQuery.matches;
      this.reducedMotionQuery.addEventListener(
        "change",
        this.onReducedMotionChange
      );
    }

    this.snapshot = this.createSnapshot();

    document.documentElement.classList.add("smooth-scroll-active");

    if (this.smoothWheel) {
      this.virtualScroll = new VirtualScroll(window, this.onVirtualScroll, {
        wheelMultiplier: options.wheelMultiplier ?? 1,
        allowNestedScroll: options.allowNestedScroll ?? true,
        prevent: options.prevent,
      });
    }

    window.addEventListener("scroll", this.onNativeScroll, { passive: true });
    window.addEventListener("resize", this.resize, { passive: true });
    if (this.anchors) {
      document.addEventListener("click", this.onAnchorClick);
      window.addEventListener("hashchange", this.onHashChange);

      // Honor deep-link URL hash on direct load after initial layout settles
      if (window.location.hash && window.location.hash.length > 1) {
        const hash = window.location.hash;
        this.initialHashTimer = window.setTimeout(() => {
          const target = document.querySelector<HTMLElement>(hash);
          if (target) {
            this.limit = this.computeLimit();
            this.scrollTo(target, { immediate: true });
          }
        }, 60);
      }
    }

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(document.documentElement);
    }

    this.lastTime = performance.now();
  }

  private ensureRaf(): void {
    if (this.rafId !== 0) return;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.raf);
  }

  get prefersReducedMotion(): boolean {
    return this._prefersReducedMotion;
  }

  get progress(): number {
    return this.limit > 0 ? clamp(0, this.animatedScroll / this.limit, 1) : 0;
  }

  getSnapshot = (): SmoothScrollSnapshot => {
    return this.snapshot;
  };

  subscribe = (listener: ScrollSubscriber): (() => void) => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };

  private createSnapshot(): SmoothScrollSnapshot {
    return {
      scroll: this.animatedScroll,
      targetScroll: this.targetScroll,
      limit: this.limit,
      progress: this.progress,
      velocity: this.velocity,
      direction: this.direction,
      isScrolling: this.isScrolling,
      isStopped: this.isStopped,
      prefersReducedMotion: this._prefersReducedMotion,
    };
  }

  private emit(): void {
    this.snapshot = this.createSnapshot();
    this.subscribers.forEach((listener) => listener(this.snapshot));
  }

  private computeLimit(): number {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollHeight - window.innerHeight);
  }

  resize = (): void => {
    const nextLimit = this.computeLimit();
    const nextTarget = clamp(0, this.targetScroll, nextLimit);
    const nextAnimated = clamp(0, this.animatedScroll, nextLimit);
    const changed =
      Math.abs(nextLimit - this.limit) > 0.5 ||
      Math.abs(nextTarget - this.targetScroll) > 0.5 ||
      Math.abs(nextAnimated - this.animatedScroll) > 0.5;

    this.limit = nextLimit;
    this.targetScroll = nextTarget;
    this.animatedScroll = nextAnimated;
    if (changed) {
      this.emit();
    }
  };

  stop(): void {
    if (this.isStopped) return;
    this.isStopped = true;
    this.animator.stop();
    this.isScrolling = false;
    this.velocity = 0;
    document.documentElement.classList.add("smooth-scroll-stopped");
    this.emit();
  }

  start(): void {
    if (!this.isStopped) return;
    this.isStopped = false;
    this.actualScroll = window.scrollY;
    this.animatedScroll = this.actualScroll;
    this.targetScroll = this.actualScroll;
    document.documentElement.classList.remove("smooth-scroll-stopped");
    this.emit();
  }

  scrollTo(
    target: number | string | HTMLElement,
    options: ScrollToOptions = {}
  ): void {
    if (this.isStopped && !options.force) return;

    this.limit = this.computeLimit();
    const offset = options.offset ?? 0;
    let targetY = 0;

    if (typeof target === "number") {
      targetY = target;
    } else if (target === "top" || target === "start") {
      targetY = 0;
    } else if (target === "bottom" || target === "end") {
      targetY = this.limit;
    } else {
      const element =
        typeof target === "string"
          ? document.querySelector<HTMLElement>(target)
          : target;
      if (!element) return;
      const marginTop = getElementScrollMarginTop(element);
      targetY = element.getBoundingClientRect().top + window.scrollY - marginTop;
    }

    targetY = clamp(0, targetY + offset, this.limit);

    const immediate = options.immediate || this._prefersReducedMotion;
    if (immediate || Math.abs(targetY - this.animatedScroll) < 0.5) {
      this.animator.stop();
      this.targetScroll = targetY;
      this.animatedScroll = targetY;
      this.actualScroll = targetY;
      this.velocity = 0;
      this.isScrolling = false;
      this.prevProgrammaticScroll = targetY;
      this.lastProgrammaticScroll = targetY;
      window.scrollTo(0, targetY);
      this.emit();
      options.onComplete?.();
      return;
    }

    this.targetScroll = targetY;
    this.isLocked = Boolean(options.lock);
    this.onCompleteCallback = options.onComplete;

    this.animator.fromTo(this.animatedScroll, targetY, {
      duration: options.duration ?? this.defaultDuration,
      easing: options.easing ?? this.defaultEasingFn,
      lerp: options.lerp,
      onStart: () => {
        this.isScrolling = "smooth";
      },
      onUpdate: (value, completed) => {
        const delta = value - this.animatedScroll;
        this.velocity = delta;
        this.direction = delta > 0 ? 1 : delta < 0 ? -1 : this.direction;
        this.animatedScroll = value;
        this.actualScroll = value;
        this.prevProgrammaticScroll = this.lastProgrammaticScroll;
        this.lastProgrammaticScroll = value;
        window.scrollTo(0, value);

        if (completed) {
          this.isLocked = false;
          this.isScrolling = false;
          this.velocity = 0;
          const cb = this.onCompleteCallback;
          this.onCompleteCallback = undefined;
          cb?.();
        }
        this.emit();
      },
    });
    this.ensureRaf();
  }

  private onVirtualScroll = ({ deltaY, event }: VirtualScrollPayload): void => {
    if (this.isStopped || this.isLocked) {
      if (this.isStopped) event.preventDefault();
      return;
    }

    // Never hijack pure horizontal trackpad gestures
    if (Math.abs(deltaY) < 0.01) {
      return;
    }

    // Honor prefers-reduced-motion: let browser scroll natively 1:1
    if (this._prefersReducedMotion) {
      return;
    }

    // Refresh limit only at the start of a scroll gesture to avoid per-wheel forced layout
    if (this.isScrolling !== "smooth") {
      this.limit = this.computeLimit();
    }
    const base =
      this.isScrolling === "smooth" ? this.targetScroll : window.scrollY;
    const nextTarget = clamp(0, base + deltaY, this.limit);

    if (Math.abs(nextTarget - this.animatedScroll) < 0.1) {
      if (this.isScrolling === "smooth") {
        event.preventDefault();
      }
      return;
    }

    event.preventDefault();

    this.targetScroll = nextTarget;
    this.animator.fromTo(this.animatedScroll, nextTarget, {
      lerp: this.lerpFactor,
      onStart: () => {
        this.isScrolling = "smooth";
      },
      onUpdate: (value, completed) => {
        const delta = value - this.animatedScroll;
        this.velocity = delta;
        this.direction = delta > 0 ? 1 : delta < 0 ? -1 : this.direction;
        this.animatedScroll = value;
        this.actualScroll = value;
        this.prevProgrammaticScroll = this.lastProgrammaticScroll;
        this.lastProgrammaticScroll = value;
        window.scrollTo(0, value);

        if (completed) {
          this.isScrolling = false;
          this.velocity = 0;
        }
        this.emit();
      },
    });
    this.ensureRaf();
  };

  private onNativeScroll = (): void => {
    const nextScroll = window.scrollY;
    if (this.isScrolling === "smooth") {
      const minProg =
        Math.min(this.prevProgrammaticScroll, this.lastProgrammaticScroll) - 4;
      const maxProg =
        Math.max(this.prevProgrammaticScroll, this.lastProgrammaticScroll) + 4;
      const tolerance = Math.max(4, Math.abs(this.velocity) * 1.5);
      if (
        Math.abs(nextScroll - this.animatedScroll) <= tolerance ||
        Math.abs(nextScroll - this.lastProgrammaticScroll) <= 4 ||
        (nextScroll >= minProg && nextScroll <= maxProg)
      ) {
        return;
      }

      this.animator.stop();
      this.isLocked = false;
    }

    const delta = nextScroll - this.actualScroll;
    this.actualScroll = nextScroll;
    this.animatedScroll = nextScroll;
    this.targetScroll = nextScroll;
    this.velocity = delta;
    this.direction = delta > 0 ? 1 : delta < 0 ? -1 : this.direction;
    this.isScrolling = "native";
    this.emit();

    window.clearTimeout(this.nativeScrollResetTimer);
    this.nativeScrollResetTimer = window.setTimeout(() => {
      if (this.isScrolling === "native") {
        this.isScrolling = false;
        this.velocity = 0;
        this.emit();
      }
    }, 120);
  };

  private onAnchorClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;

    const destination = document.querySelector<HTMLElement>(href);
    if (!destination) return;

    event.preventDefault();
    const isTopAnchor = href === "#top";
    this.scrollTo(isTopAnchor ? 0 : destination, {
      offset: isTopAnchor ? 0 : this.anchorOffset,
      duration: 1.0,
    });

    if (window.history?.pushState) {
      window.history.pushState(null, "", href);
    }
  };

  private onHashChange = (): void => {
    const hash = window.location.hash;
    if (!hash || hash === "#") return;
    if (hash === "#top") {
      this.scrollTo(0, { duration: 0.9 });
      return;
    }
    const destination = document.querySelector<HTMLElement>(hash);
    if (destination) {
      this.scrollTo(destination, {
        offset: this.anchorOffset,
        duration: 0.9,
      });
    }
  };

  private onReducedMotionChange = (event: MediaQueryListEvent): void => {
    this._prefersReducedMotion = this.respectReducedMotion && event.matches;
    if (this._prefersReducedMotion) {
      this.animator.stop();
      this.isScrolling = false;
      this.velocity = 0;
    }
    this.emit();
  };

  private raf = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.animator.isRunning) {
      this.animator.advance(dt);
    }

    if (this.animator.isRunning) {
      this.rafId = requestAnimationFrame(this.raf);
    } else {
      this.rafId = 0;
    }
  };

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    window.clearTimeout(this.nativeScrollResetTimer);
    window.clearTimeout(this.initialHashTimer);
    this.animator.stop();
    this.virtualScroll?.destroy();
    this.resizeObserver?.disconnect();
    this.reducedMotionQuery?.removeEventListener(
      "change",
      this.onReducedMotionChange
    );
    window.removeEventListener("scroll", this.onNativeScroll);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("click", this.onAnchorClick);
    window.removeEventListener("hashchange", this.onHashChange);
    document.documentElement.classList.remove(
      "smooth-scroll-active",
      "smooth-scroll-stopped"
    );
    this.subscribers.clear();
  }
}
