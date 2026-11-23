export interface VirtualScrollPayload {
  deltaX: number;
  deltaY: number;
  event: WheelEvent;
}

export interface VirtualScrollOptions {
  wheelMultiplier?: number;
  allowNestedScroll?: boolean;
  prevent?: (node: HTMLElement, event: WheelEvent) => boolean;
}

type VirtualScrollListener = (payload: VirtualScrollPayload) => void;

const LINE_HEIGHT_PX = 16;

function hasPreventAttribute(node: HTMLElement): boolean {
  return (
    node.hasAttribute("data-lenis-prevent") ||
    node.hasAttribute("data-lenis-prevent-wheel") ||
    node.hasAttribute("data-lenis-prevent-vertical") ||
    node.hasAttribute("data-smooth-prevent")
  );
}

const NON_SCROLLABLE_TAGS = new Set([
  "SPAN",
  "A",
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "DT",
  "DD",
  "STRONG",
  "EM",
  "SMALL",
  "LABEL",
  "BUTTON",
  "IMG",
  "SVG",
  "PATH",
  "CANVAS",
]);

function canScrollNatively(node: HTMLElement, deltaY: number): boolean {
  if (node === document.body || node === document.documentElement) return false;
  if (NON_SCROLLABLE_TAGS.has(node.tagName)) return false;
  if (node.scrollHeight <= node.clientHeight + 1) return false;
  const overflowY = window.getComputedStyle(node).overflowY;
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") {
    return false;
  }

  if (deltaY > 0) {
    return node.scrollTop + node.clientHeight < node.scrollHeight - 1;
  }
  if (deltaY < 0) {
    return node.scrollTop > 1;
  }
  return false;
}

/**
 * Rewrites Lenis's VirtualScroll wheel normalizer for React + Vite.
 * Handles pixel/line/page wheel modes, pinch-zoom passthrough,
 * data-lenis-prevent attributes, and nested scrollable containers.
 */
export class VirtualScroll {
  private element: Window | HTMLElement;
  private wheelMultiplier: number;
  private allowNestedScroll: boolean;
  private prevent?: (node: HTMLElement, event: WheelEvent) => boolean;
  private listener: VirtualScrollListener;

  constructor(
    element: Window | HTMLElement,
    listener: VirtualScrollListener,
    options: VirtualScrollOptions = {}
  ) {
    this.element = element;
    this.listener = listener;
    this.wheelMultiplier = options.wheelMultiplier ?? 1;
    this.allowNestedScroll = options.allowNestedScroll ?? true;
    this.prevent = options.prevent;

    this.element.addEventListener("wheel", this.onWheel as EventListener, {
      passive: false,
    });
  }

  private shouldPrevent(event: WheelEvent, deltaY: number): boolean {
    // Allow native browser pinch-zoom (Ctrl+Wheel / trackpad pinch)
    if (event.ctrlKey || event.metaKey) return true;

    const path = event.composedPath();
    for (const target of path) {
      if (!(target instanceof HTMLElement)) continue;
      if (hasPreventAttribute(target)) return true;
      if (this.prevent?.(target, event)) return true;
      if (this.allowNestedScroll && canScrollNatively(target, deltaY)) {
        return true;
      }
    }
    return false;
  }

  private onWheel = (event: WheelEvent): void => {
    let { deltaX, deltaY } = event;
    const { deltaMode } = event;

    // Normalize line and page scroll units to pixels (Lenis convention)
    if (deltaMode === 1) {
      deltaX *= LINE_HEIGHT_PX;
      deltaY *= LINE_HEIGHT_PX;
    } else if (deltaMode === 2) {
      deltaX *= window.innerWidth;
      deltaY *= window.innerHeight;
    }

    deltaX *= this.wheelMultiplier;
    deltaY *= this.wheelMultiplier;

    if (this.shouldPrevent(event, deltaY)) {
      return;
    }

    this.listener({ deltaX, deltaY, event });
  };

  destroy(): void {
    this.element.removeEventListener("wheel", this.onWheel as EventListener);
  }
}
