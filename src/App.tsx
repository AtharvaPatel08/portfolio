/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Moon, Sun } from "lucide-react";
import {
  ContourFieldCanvas,
  DriftingStrokesCanvas,
  ProjectPlateCanvas,
} from "./components/canvas/PortfolioCanvases";
import {
  SmoothScrollProvider,
  useSmoothScroll,
  useSmoothScrollEffect,
} from "./components/scroll/SmoothScrollProvider";
import { SchemaMarkup } from "./components/seo/SchemaMarkup";
import { ThemeProvider, useTheme } from "./components/theme/ThemeProvider";
import { PORTFOLIO_DATA, type ProjectItem } from "./data/portfolio";
import type { SmoothScrollSnapshot } from "./lib/smooth-scroll/engine";

type WorkFilter = "all" | "products" | "python";

interface StageMetrics {
  heroTop: number;
  heroSpan: number;
  manifestoTop: number;
  manifestoHeight: number;
  manifestoSpan: number;
  railTop: number;
  railHeight: number;
  railSpan: number;
  railOverflow: number;
  artifactTop: number;
  artifactHeight: number;
  artifactItemMids: number[];
  indexTop: number;
  indexHeight: number;
  experienceTop: number;
  seasonTop: number;
  seasonHeight: number;
  seasonSpan: number;
  contactTop: number;
  footerTop: number;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    const clampedX = clamp01(x);
    if (clampedX === 0 || clampedX === 1) return clampedX;

    let t = clampedX;
    for (let i = 0; i < 6; i++) {
      const err = sampleX(t) - clampedX;
      if (Math.abs(err) < 1e-5) break;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t = clamp01(t - err / d);
    }

    // Bisection fallback for guaranteed monotonicity
    let lo = 0;
    let hi = 1;
    let err = sampleX(t) - clampedX;
    if (Math.abs(err) >= 1e-4) {
      t = clampedX;
      for (let i = 0; i < 10; i++) {
        err = sampleX(t) - clampedX;
        if (Math.abs(err) < 1e-5) break;
        if (err < 0) lo = t;
        else hi = t;
        t = (lo + hi) * 0.5;
      }
    }

    return clamp01(sampleY(t));
  };
}

const easeHeroFade = cubicBezier(0.65, 0, 0.35, 1);

function rangeProgress(p: number, start: number, end: number): number {
  if (end <= start) return p >= end ? 1 : 0;
  return clamp01((p - start) / (end - start));
}

function PortfolioExperience() {
  const { scrollTo, stop, start, engine } = useSmoothScroll();
  const { theme, toggleTheme } = useTheme();
  const {
    identity,
    navLinks,
    about,
    expertise,
    projects,
    experience,
    education,
    exploring,
    beyondCode,
    contact,
    footer,
  } = PORTFOLIO_DATA;

  const internship = experience.items[0];

  // Discrete phase & interactive states (scroll phases update ONLY when integer index changes)
  const [artifactPhase, setArtifactPhase] = useState(0);
  const [seasonChapter, setSeasonChapter] = useState(0);
  const [workFilter, setWorkFilter] = useState<WorkFilter>("all");
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(
    null
  );
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [railStatic, setRailStatic] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNavHref, setActiveNavHref] = useState<string>("");

  const lastArtifactPhaseRef = useRef(0);
  const lastSeasonChapterRef = useRef(0);
  const lastNavToneRef = useRef<"primary" | "secondary">("primary");
  const lastActiveNavRef = useRef<string>("");
  const lastRailStaticRef = useRef(false);
  const pendingRailAnchorRef = useRef(false);
  const measureRafRef = useRef(0);
  const copyTimerRef = useRef<number | null>(null);
  const modalCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);

  // Refs for cached stage geometry (zero per-frame layout thrashing)
  const navRef = useRef<HTMLElement | null>(null);
  const heroStageRef = useRef<HTMLElement | null>(null);
  const heroLineTopRef = useRef<HTMLParagraphElement | null>(null);
  const heroLineNameRef = useRef<HTMLHeadingElement | null>(null);
  const manifestoStageRef = useRef<HTMLElement | null>(null);
  const manifestoBaseRef = useRef<HTMLParagraphElement | null>(null);
  const manifestoFillRef = useRef<HTMLParagraphElement | null>(null);
  const railStageRef = useRef<HTMLElement | null>(null);
  const railInnerRef = useRef<HTMLDivElement | null>(null);
  const railTrackRef = useRef<HTMLDivElement | null>(null);
  const artifactStageRef = useRef<HTMLElement | null>(null);
  const artifactItemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const indexBandRef = useRef<HTMLElement | null>(null);
  const experienceRef = useRef<HTMLDivElement | null>(null);
  const seasonStageRef = useRef<HTMLElement | null>(null);
  const contactRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);

  const metricsRef = useRef<StageMetrics>({
    heroTop: 0,
    heroSpan: 1,
    manifestoTop: 0,
    manifestoHeight: 1,
    manifestoSpan: 1,
    railTop: 0,
    railHeight: 1,
    railSpan: 1,
    railOverflow: 0,
    artifactTop: 0,
    artifactHeight: 1,
    artifactItemMids: [],
    indexTop: 99999,
    indexHeight: 1,
    experienceTop: 99999,
    seasonTop: 0,
    seasonHeight: 1,
    seasonSpan: 1,
    contactTop: 99999,
    footerTop: 99999,
  });

  // Real portfolio data mapped cleanly into the 4 cumulative artifact phases
  const artifactPhases = useMemo(() => {
    const progGroup = expertise.groups[0];
    const aiGroup = expertise.groups[1];
    const designGroup = expertise.groups[2];
    const ecoGroup = expertise.groups[3];

    return [
      {
        cueCode: "01",
        cueTitle: progGroup.title,
        cueNote: `${progGroup.items.join(" · ")} — ${progGroup.subtitle}.`,
        statusLine: `${progGroup.index} / ${progGroup.title.toUpperCase()}`,
        toolkitValue: progGroup.items.join(" · "),
        experienceValue: "PENDING SCROLL",
        educationValue: "PENDING SCROLL",
      },
      {
        cueCode: "02",
        cueTitle: `${aiGroup.title} & Design`,
        cueNote: `${[...aiGroup.items, ...designGroup.items, ...ecoGroup.items].join(" · ")}.`,
        statusLine: `02 / AI WORKFLOWS, FIGMA & GITHUB`,
        toolkitValue: "PYTHON · AI STUDIO · CURSOR · FIGMA",
        experienceValue: "PENDING SCROLL",
        educationValue: "PENDING SCROLL",
      },
      {
        cueCode: "03",
        cueTitle: experience.items[0].organization,
        cueNote: `${internship.position} (${internship.type}) · ${internship.duration}.`,
        statusLine: `03 / ${internship.legalEntity.toUpperCase()}`,
        toolkitValue: "PYTHON · AI STUDIO · CURSOR · FIGMA",
        experienceValue: `${internship.organization.toUpperCase()} · ${internship.position.toUpperCase()}`,
        educationValue: "PENDING SCROLL",
      },
      {
        cueCode: "04",
        cueTitle: education.shortInstitution,
        cueNote: `${education.degree} · ${education.currentYear} · Class of ${education.expectedGraduation}.`,
        statusLine: `04 / ${education.shortInstitution.toUpperCase()} · CLASS OF ${education.expectedGraduation}`,
        toolkitValue: "PYTHON · AI STUDIO · CURSOR · FIGMA",
        experienceValue: `${internship.organization.toUpperCase()} · ${internship.position.toUpperCase()}`,
        educationValue: `${education.shortInstitution.toUpperCase()} · B.TECH AI/ML · ${education.expectedGraduation}`,
      },
    ];
  }, [expertise.groups, experience.items, internship, education]);

  const filteredProjects = useMemo(() => {
    return projects.items.filter((item) => {
      if (workFilter === "all") return true;
      if (workFilter === "products")
        return item.id === "scrth" || item.id === "batalarm";
      return item.id === "qr-code-generator" || item.id === "data-analysis";
    });
  }, [projects.items, workFilter]);

  // Verify each single-line poster lockup fits strictly inside its clientWidth without clipping
  const verifyPosterLockupFit = useCallback(() => {
    const candidates: (HTMLElement | null)[] = [
      window.innerWidth >= 640 ? heroLineTopRef.current : null,
      heroLineNameRef.current,
    ];
    if (window.innerWidth < 640 && heroLineTopRef.current) {
      heroLineTopRef.current.style.removeProperty("--fit-scale");
    }
    const lines = candidates.filter((el): el is HTMLElement => el !== null);
    if (!lines.length) return;

    for (const el of lines) {
      el.style.removeProperty("--fit-scale");
    }

    const ratios = lines.map((el) => {
      const cw = el.clientWidth;
      const sw = el.scrollWidth;
      return cw > 0 && sw > cw + 1 ? Math.max(0.45, (cw - 2) / sw) : null;
    });

    lines.forEach((el, idx) => {
      const ratio = ratios[idx];
      if (ratio !== null) {
        el.style.setProperty("--fit-scale", ratio.toFixed(4));
      }
    });
  }, []);

  const measureLayout = useCallback(() => {
    const vh = Math.max(window.innerHeight, 1);
    const vw = window.innerWidth;

    const measureStage = (el: HTMLElement | null) => {
      if (!el) return { top: 0, span: 1, height: 1 };
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const height = Math.max(el.offsetHeight, 1);
      const innerEl = el.querySelector<HTMLElement>(".ed-stage-inner");
      const innerH =
        innerEl && innerEl.offsetHeight > 0 ? innerEl.offsetHeight : vh;
      const span = Math.max(height - innerH, 1);
      return { top, span, height };
    };

    // Size Stage 3 ("Ideas made tangible.") to its exact horizontal overflow BEFORE measuring downstream sections
    const railEl = railStageRef.current;
    const track = railTrackRef.current;
    const inner = railInnerRef.current;
    const viewportWidth = inner ? inner.clientWidth : vw;
    const isShortViewport = vh <= 600;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (railEl) {
      const padInline =
        vw < 640
          ? 20
          : Math.max(32, Math.round((viewportWidth - 1440) / 2 + 32));
      const padInlineVal = `${padInline}px`;
      if (railEl.style.getPropertyValue("--rail-pad-inline") !== padInlineVal) {
        railEl.style.setProperty("--rail-pad-inline", padInlineVal);
      }
    }

    const trackWidth = track
      ? Math.max(track.scrollWidth, track.offsetWidth)
      : 0;
    const railOverflow =
      track && vw >= 640 && !isShortViewport && !prefersReduced
        ? Math.max(0, trackWidth - viewportWidth)
        : 0;

    const nextRailStatic =
      vw >= 640 && !isShortViewport && !prefersReduced && railOverflow <= 2;

    if (railEl) {
      const railScrollSpan =
        railOverflow > 2 ? Math.round(railOverflow * 1.1) : 0;
      const nextSpanVal = `${railScrollSpan}px`;
      if (railEl.style.getPropertyValue("--rail-scroll-span") !== nextSpanVal) {
        railEl.style.setProperty("--rail-scroll-span", nextSpanVal);
      }
      const nextStaticStr = nextRailStatic ? "true" : "false";
      if (railEl.dataset.static !== nextStaticStr) {
        railEl.dataset.static = nextStaticStr;
      }
    }

    if (nextRailStatic !== lastRailStaticRef.current) {
      lastRailStaticRef.current = nextRailStatic;
      setRailStatic(nextRailStatic);
    }

    const hero = measureStage(heroStageRef.current);
    const manifesto = measureStage(manifestoStageRef.current);

    const railTop = railEl
      ? railEl.getBoundingClientRect().top + window.scrollY
      : 0;
    const railHeight = railEl ? Math.max(railEl.offsetHeight, 1) : 1;
    const railInnerH = inner && inner.offsetHeight > 0 ? inner.offsetHeight : vh;
    const railSpan = Math.max(railHeight - railInnerH, 1);

    const artifact = measureStage(artifactStageRef.current);
    const artifactItemMids = artifactItemRefs.current
      .filter((el): el is HTMLLIElement => el !== null)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top + window.scrollY + rect.height * 0.5;
      });

    const indexBand = measureStage(indexBandRef.current);
    const experienceTop = experienceRef.current
      ? experienceRef.current.getBoundingClientRect().top + window.scrollY
      : indexBand.top;
    const season = measureStage(seasonStageRef.current);
    const contactTop = contactRef.current
      ? contactRef.current.getBoundingClientRect().top + window.scrollY
      : Number.MAX_SAFE_INTEGER;
    const footerTop = footerRef.current
      ? footerRef.current.getBoundingClientRect().top + window.scrollY
      : Number.MAX_SAFE_INTEGER;

    metricsRef.current = {
      heroTop: hero.top,
      heroSpan: hero.span,
      manifestoTop: manifesto.top,
      manifestoHeight: manifesto.height,
      manifestoSpan: manifesto.span,
      railTop,
      railHeight,
      railSpan,
      railOverflow,
      artifactTop: artifact.top,
      artifactHeight: artifact.height,
      artifactItemMids,
      indexTop: indexBand.top,
      indexHeight: indexBand.height,
      experienceTop,
      seasonTop: season.top,
      seasonHeight: season.height,
      seasonSpan: season.span,
      contactTop,
      footerTop,
    };

    verifyPosterLockupFit();

    // Ensure manifesto duplicate overlay matches base dimensions on all four edges
    if (manifestoBaseRef.current && manifestoFillRef.current) {
      const baseH = manifestoBaseRef.current.offsetHeight;
      const fillH = manifestoFillRef.current.offsetHeight;
      if (Math.abs(baseH - fillH) > 1) {
        manifestoFillRef.current.style.width = `${manifestoBaseRef.current.offsetWidth}px`;
      } else {
        manifestoFillRef.current.style.removeProperty("width");
      }
    }
  }, [verifyPosterLockupFit]);

  // ONE coordinated scroll handler writing all CSS custom properties to :root
  const applyScrollChoreography = useCallback(
    (snapshot: SmoothScrollSnapshot) => {
      const root = document.documentElement;
      const m = metricsRef.current;
      const y = snapshot.scroll;

      // Global top read progress bar
      root.style.setProperty("--page-p", snapshot.progress.toFixed(4));

      // Under reduced motion, keep all stages resting cleanly and show final dossier values
      if (snapshot.prefersReducedMotion) {
        root.style.setProperty("--packet-meter", "1");
        if (lastArtifactPhaseRef.current !== 3) {
          lastArtifactPhaseRef.current = 3;
          setArtifactPhase(3);
        }
        return;
      }

      // STAGE 1: Opening Hero — ATHARVA PATEL (Three independent CSS variables on separate curves)
      const pHero = clamp01((y - m.heroTop) / m.heroSpan);
      const heroY = -90 * easeOutQuad(rangeProgress(pHero, 0, 0.98));
      const heroScale =
        1 - 0.24 * easeInOutQuad(rangeProgress(pHero, 0.04, 1));
      const heroFadeProgress = easeHeroFade(rangeProgress(pHero, 0.22, 1));
      const heroAlpha = 1 - heroFadeProgress;
      const heroMetaAlpha = 1 - easeInOutQuad(rangeProgress(pHero, 0.06, 0.62));

      root.style.setProperty("--hero-type-y", `${heroY.toFixed(2)}px`);
      root.style.setProperty("--hero-type-scale", heroScale.toFixed(4));
      root.style.setProperty("--hero-type-alpha", heroAlpha.toFixed(4));
      root.style.setProperty("--hero-meta-alpha", heroMetaAlpha.toFixed(4));

      // STAGE 2: Manifesto / About — Bottom-Up Ink Wipe
      const pManifesto = clamp01((y - m.manifestoTop) / m.manifestoSpan);
      const wipePct = rangeProgress(pManifesto, 0.06, 0.94) * 100;
      const manifestoScale = 1 + 0.05 * easeInOutQuad(pManifesto);

      root.style.setProperty("--manifesto-wipe", `${wipePct.toFixed(2)}%`);
      root.style.setProperty("--manifesto-scale", manifestoScale.toFixed(4));

      // STAGE 3: Projects — Horizontal Editorial Rail (exact overflow width, zero trailing blank scroll)
      const pRail =
        m.railOverflow <= 2 ? 1 : clamp01((y - m.railTop) / m.railSpan);
      const railX = m.railOverflow <= 2 ? 0 : -pRail * m.railOverflow;

      root.style.setProperty("--rail-x", `${railX.toFixed(2)}px`);
      root.style.setProperty("--rail-progress", pRail.toFixed(4));

      // STAGE 4: Things I Work With — Sticky Technical Dossier synced cleanly to left-side items
      const mids = m.artifactItemMids;
      let nextArtPhase = 0;
      let packetMeter = 0.25;

      if (mids.length > 0) {
        const focusY = y + window.innerHeight * 0.48;
        const firstMid = mids[0];
        const lastMid = mids[mids.length - 1];
        const itemProgress = clamp01(
          (focusY - firstMid) / Math.max(lastMid - firstMid, 1)
        );
        packetMeter = 0.25 + 0.75 * itemProgress;

        for (let i = 0; i < mids.length; i++) {
          const threshold = i === 0 ? -Infinity : (mids[i - 1] + mids[i]) * 0.5;
          if (focusY >= threshold) {
            nextArtPhase = i;
          }
        }
      }

      root.style.setProperty("--packet-meter", packetMeter.toFixed(4));

      if (nextArtPhase !== lastArtifactPhaseRef.current) {
        lastArtifactPhaseRef.current = nextArtPhase;
        setArtifactPhase(nextArtPhase);
      }

      // STAGE 5: Closing Generative Contour Visual (translateY -4% to 4%, scale 1.10 to 1.055)
      const pSeason = clamp01((y - m.seasonTop) / m.seasonSpan);
      const seasonY = -4 + 8 * pSeason;
      const seasonScale = 1.1 - 0.045 * pSeason;

      root.style.setProperty("--season-y", `${seasonY.toFixed(3)}%`);
      root.style.setProperty("--season-scale", seasonScale.toFixed(4));

      const nextChapter = Math.min(2, Math.floor(pSeason * 3));
      if (nextChapter !== lastSeasonChapterRef.current) {
        lastSeasonChapterRef.current = nextChapter;
        setSeasonChapter(nextChapter);
      }

      // Adaptive masthead surface tone (primary over Hero, secondary over all non-hero pages)
      const probeY = y + 32;
      const inSecondaryBand = probeY >= m.manifestoTop;
      const nextTone: "primary" | "secondary" = inSecondaryBand
        ? "secondary"
        : "primary";
      if (nextTone !== lastNavToneRef.current && navRef.current) {
        lastNavToneRef.current = nextTone;
        navRef.current.dataset.tone = nextTone;
      }

      // Selected navigation state tracking (updates only when active section changes)
      const navProbeY = y + 140;
      let nextActiveNav = "";
      if (navProbeY >= m.contactTop) nextActiveNav = "#contact";
      else if (navProbeY >= m.experienceTop) nextActiveNav = "#experience";
      else if (navProbeY >= m.artifactTop) nextActiveNav = "#expertise";
      else if (navProbeY >= m.railTop) nextActiveNav = "#work";
      else if (navProbeY >= m.manifestoTop) nextActiveNav = "#about";

      if (nextActiveNav !== lastActiveNavRef.current) {
        lastActiveNavRef.current = nextActiveNav;
        setActiveNavHref(nextActiveNav);
      }
    },
    []
  );

  useSmoothScrollEffect(applyScrollChoreography);

  // Measure on mount, resize, orientation change, filter updates, and webfont completion (rAF-coalesced)
  useEffect(() => {
    let active = true;

    const runSync = () => {
      measureRafRef.current = 0;
      if (!active) return;
      measureLayout();
      if (engine) {
        engine.resize();
        if (pendingRailAnchorRef.current) {
          pendingRailAnchorRef.current = false;
          engine.scrollTo(metricsRef.current.railTop, { duration: 0.4 });
        }
        applyScrollChoreography(engine.getSnapshot());
      }
    };

    const scheduleSync = () => {
      if (!active || measureRafRef.current) return;
      measureRafRef.current = window.requestAnimationFrame(runSync);
    };

    runSync();

    const ro = new ResizeObserver(scheduleSync);
    ro.observe(document.documentElement);
    if (railTrackRef.current) ro.observe(railTrackRef.current);

    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("orientationchange", scheduleSync, { passive: true });
    document.fonts?.ready.then(() => {
      if (active) scheduleSync();
    });

    return () => {
      active = false;
      if (measureRafRef.current) {
        window.cancelAnimationFrame(measureRafRef.current);
        measureRafRef.current = 0;
      }
      ro.disconnect();
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
    };
  }, [measureLayout, applyScrollChoreography, engine, workFilter]);

  // Close mobile menu on ESC or viewport resize past desktop breakpoint
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileMenuOpen]);

  // Lock background scroll, manage focus, & support ESC when Project Dossier Modal is open
  useEffect(() => {
    if (!selectedProject) return;
    modalTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    stop();
    const focusTimer = window.requestAnimationFrame(() => {
      modalCloseBtnRef.current?.focus();
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedProject(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      start();
      modalTriggerRef.current?.focus();
      modalTriggerRef.current = null;
    };
  }, [selectedProject, stop, start]);

  // Clean up email clipboard feedback timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(identity.email);
      setCopiedEmail(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedEmail(false);
        copyTimerRef.current = null;
      }, 2400);
    } catch {
      window.location.href = `mailto:${identity.email}`;
    }
  };

  // Character-count sizing inputs for Stage 1 poster lockup
  const fullHeadline = `${identity.headlineStart} ${identity.headlineAccent} ${identity.headlineEnd}`;
  const headlineChars = fullHeadline.length;
  const nameChars = identity.name.length;

  const currentPhase = artifactPhases[artifactPhase];
  const activeTopic = exploring.topics[activeTopicIndex] ?? exploring.topics[0];

  const filterButtons: { id: WorkFilter; label: string }[] = [
    { id: "all", label: `All Work (${projects.items.length})` },
    { id: "products", label: "Web & Apps" },
    { id: "python", label: "Python & Data" },
  ];

  return (
    <div
      id="top"
      className="relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]"
    >
      <SchemaMarkup />

      {/* Global 2px Burgundy Read Progress Bar */}
      <div className="ed-scroll-meter" aria-hidden="true">
        <div className="ed-scroll-meter-fill" />
      </div>

      {/* Fixed Luxury Editorial Masthead — 3-Zone Top Bar Contract */}
      <header ref={navRef} data-tone="primary" className="ed-nav">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-5 py-3 sm:px-8">
          <a
            href="#top"
            className="ed-display-caps inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-lg tracking-[0.14em] text-[var(--text-primary)] sm:text-xl"
          >
            <span>ATHARVA</span>
            <span className="ed-nav-brand-accent text-[var(--accent)]">
              PATEL
            </span>
          </a>

          <nav
            aria-label="Primary portfolio navigation"
            className="hidden items-center gap-7 md:flex"
          >
            {navLinks.map((item) => {
              const isSelected = activeNavHref === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={isSelected ? "location" : undefined}
                  className={`ed-mono shrink-0 whitespace-nowrap transition-colors duration-150 ${
                    isSelected
                      ? "text-[var(--accent-secondary)] underline decoration-[var(--accent-secondary)] decoration-1 underline-offset-[6px]"
                      : "text-[var(--text-primary)] hover:text-[var(--accent-secondary)]"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              aria-pressed={theme === "dark"}
              title={
                theme === "dark"
                  ? "Switch to Light Mode"
                  : "Switch to Dark Mode"
              }
              className="ed-control ed-nav-icon-btn inline-flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center border border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--accent-secondary)] transition-colors duration-200 hover:border-[var(--accent-secondary)] hover:bg-[var(--accent-secondary-soft)] hover:text-[var(--accent-secondary-hover)] active:scale-[0.97]"
            >
              {theme === "dark" ? (
                <Sun size={16} strokeWidth={1.65} aria-hidden="true" />
              ) : (
                <Moon size={16} strokeWidth={1.65} aria-hidden="true" />
              )}
            </button>

            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="ed-mono ed-control inline-flex min-h-[38px] shrink-0 items-center whitespace-nowrap border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[var(--accent-fg)] transition-colors duration-200 hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]"
            >
              GET IN TOUCH
            </a>

            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={
                mobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="ed-mono ed-control ed-nav-icon-btn inline-flex min-h-[38px] cursor-pointer items-center border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-1.5 text-[var(--text-primary)] transition-colors duration-150 hover:border-[var(--accent-secondary)] hover:text-[var(--accent-secondary)] md:hidden"
            >
              {mobileMenuOpen ? "CLOSE" : "MENU"}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-nav-drawer"
            aria-label="Mobile portfolio navigation"
            className="ed-light-paper border-t border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 md:hidden"
          >
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {navLinks.map((item) => {
                const isSelected = activeNavHref === item.href;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-current={isSelected ? "location" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`ed-mono block py-3 transition-colors duration-150 ${
                        isSelected
                          ? "text-[var(--accent-secondary)]"
                          : "text-[var(--text-primary)] hover:text-[var(--accent-secondary)]"
                      }`}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      <main id="main-content">
        {/* ================================================================
            STAGE 1: OPENING POSTER HERO — ATHARVA PATEL (235svh, Primary Surface)
            ================================================================ */}
        <section
          ref={heroStageRef}
          aria-label="Atharva Patel Introduction"
          className="ed-stage ed-stage-hero"
        >
          <div className="ed-stage-inner flex flex-col justify-between">
            <DriftingStrokesCanvas />

            {/* Top spacer for fixed masthead */}
            <div className="h-14 shrink-0" aria-hidden="true" />

            {/* Centered Poster Identity Lockup Driven by 3 Independent Variables */}
            <div className="ed-hero-lockup relative z-10 flex w-full flex-col items-center justify-center px-4 text-center">
              <p
                ref={heroLineTopRef}
                className="ed-display-caps w-full max-w-[94vw] leading-[1.15] text-[var(--text-muted)] sm:whitespace-nowrap sm:leading-[1.05]"
                style={
                  {
                    fontSize: `calc(min(clamp(15px, 2vw, 24px), calc(92vw / (${headlineChars} * 0.56))) * var(--fit-scale, 1))`,
                    letterSpacing: "0.08em",
                  } as CSSProperties
                }
              >
                {identity.headlineStart}{" "}
                <span className="italic text-[var(--accent)]">
                  {identity.headlineAccent}
                </span>{" "}
                {identity.headlineEnd}
              </p>

              <h1
                ref={heroLineNameRef}
                className="ed-display-caps mt-3 w-full max-w-[94vw] whitespace-nowrap font-medium"
                style={
                  {
                    fontSize: `calc(min(clamp(50px, 14vw, 188px), 24svh, calc(92vw / (${nameChars} * 0.62))) * var(--fit-scale, 1))`,
                    letterSpacing: "0.02em",
                    lineHeight: 0.92,
                  } as CSSProperties
                }
              >
                <span className="text-[var(--text-primary)]">ATHARVA</span>{" "}
                <span className="italic text-[var(--accent)]">PATEL</span>
              </h1>

              <p className="mt-5 max-w-[58ch] px-2 text-sm leading-relaxed text-[var(--text-muted)] sm:mt-6 sm:text-base">
                {identity.intro}
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5 sm:mt-8">
                <a
                  href="#work"
                  className="ed-mono ed-control inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border border-[var(--accent)] bg-[var(--accent)] px-6 py-2.5 text-[var(--accent-fg)] transition-colors duration-200 hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]"
                >
                  EXPLORE MY WORK ↓
                </a>
                <a
                  href="#contact"
                  className="ed-mono ed-control inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border border-[var(--accent-secondary-border)] bg-[var(--bg-card)] px-6 py-2.5 text-[var(--accent-secondary)] transition-colors duration-200 hover:border-[var(--accent-secondary)] hover:bg-[var(--accent-secondary-soft)] hover:text-[var(--accent-secondary-hover)]"
                >
                  GET IN TOUCH ↗
                </a>
              </div>
            </div>

            {/* Bottom Pinned Mono Metadata Fading on Scroll */}
            <div className="ed-hero-meta relative z-10 border-t border-[var(--border)] px-5 py-3.5 sm:px-8">
              <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
                <span className="ed-mono inline-flex items-center gap-2 text-[var(--text-muted)]">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-secondary)]"
                    aria-hidden="true"
                  />
                  {identity.location}
                </span>
                <span className="ed-mono hidden text-[var(--text-muted)] lg:inline">
                  {identity.exploringStatus}
                </span>
                <div className="flex items-center gap-5">
                  <a
                    href={identity.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ed-mono text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--accent-secondary-hover)]"
                  >
                    GITHUB ↗
                  </a>
                  <a
                    href={identity.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ed-mono text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--accent-secondary-hover)]"
                  >
                    LINKEDIN ↗
                  </a>
                  <a
                    href="#about"
                    className="ed-mono text-[var(--text-primary)] transition-colors duration-150 hover:text-[var(--accent-secondary)]"
                  >
                    SCROLL TO READ ↓
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            STAGE 2: MANIFESTO / ABOUT — BOTTOM-UP INK WIPE (165svh, Secondary Surface)
            ================================================================ */}
        <section
          id="about"
          ref={manifestoStageRef}
          aria-label="About Manifesto"
          className="ed-stage ed-stage-manifesto ed-olive-surface"
        >
          <div className="ed-stage-inner flex flex-col justify-between px-5 pt-20 pb-8 sm:px-8">
            <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between border-b border-[var(--border-on-secondary)] pb-3">
              <span className="ed-mono text-[var(--text-secondary)]">
                {about.label}
              </span>
              <span className="ed-mono text-[var(--text-on-secondary)]">
                {about.heading}
              </span>
            </div>

            <div className="flex flex-1 items-center justify-center py-6">
              <div className="ed-manifesto-scale-box relative">
                {/* Base 34% Ink Layer */}
                <p
                  ref={manifestoBaseRef}
                  className="ed-manifesto-text ed-manifesto-base"
                >
                  {about.philosophicalQuote}
                </p>

                {/* Exact Registered Full-Ink Duplicate Wiped Bottom-Up */}
                <p
                  ref={manifestoFillRef}
                  aria-hidden="true"
                  className="ed-manifesto-text ed-manifesto-fill"
                >
                  {about.philosophicalQuote}
                </p>
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between border-t border-[var(--border-on-secondary)] pt-3">
              <span className="ed-mono text-[var(--text-on-secondary)]">
                {about.ledger[0].value}
              </span>
              <span className="ed-mono text-[var(--text-on-secondary)]">
                {about.ledger[2].value}
              </span>
            </div>
          </div>
        </section>

        {/* ================================================================
            NORMAL BAND: ABOUT BIOGRAPHY & SPECIFICATION LEDGER (Primary Surface)
            ================================================================ */}
        <section
          aria-label="About Atharva Patel Biography"
          className="ed-olive-surface border-t border-[var(--border)] bg-[var(--bg-primary)] px-5 pt-16 pb-20 sm:px-8 sm:pt-20 sm:pb-24"
        >
          <div className="mx-auto max-w-[1440px]">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <p className="ed-mono text-[var(--text-secondary)]">
                  {about.label} · PROFILE
                </p>
                <h2 className="ed-display mt-3 text-[clamp(36px,4.6vw,60px)] text-[var(--text-primary)]">
                  {about.heading}
                </h2>

                <dl className="ed-card mt-8 divide-y divide-[var(--border)] px-6">
                  {about.ledger.map((item) => (
                    <div
                      key={item.label}
                      className="flex flex-col justify-between gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-4"
                    >
                      <dt className="ed-mono shrink-0 text-[var(--text-secondary)]">
                        {item.label}
                      </dt>
                      <dd className="text-sm font-medium text-[var(--text-primary)] sm:text-right">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="flex flex-col justify-center space-y-6 lg:col-span-7">
                {about.paragraphs.map((paragraph, idx) => (
                  <p
                    key={idx}
                    className={`max-w-[64ch] text-base leading-[1.85] sm:text-[17px] ${
                      idx === 0
                        ? "font-medium text-[var(--text-primary)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            STAGE 3: SELECTED WORK — HORIZONTAL EDITORIAL RAIL (Secondary Surface)
            ================================================================ */}
        <section
          id="work"
          ref={railStageRef}
          data-static={railStatic ? "true" : "false"}
          aria-label="Selected Work Projects"
          className="ed-stage ed-stage-rail ed-olive-surface"
        >
          <div
            ref={railInnerRef}
            className="ed-stage-inner flex flex-col justify-center gap-5 pt-16 pb-6 sm:gap-7"
          >
            {/* Top Header & Existing Discipline Filter */}
            <div className="mx-auto flex w-full max-w-[1440px] shrink-0 flex-wrap items-end justify-between gap-3 px-5 sm:gap-4 sm:px-8">
              <div>
                <p className="ed-mono text-[var(--text-secondary)]">
                  {projects.label}
                </p>
                <h2 className="ed-display mt-1.5 text-[clamp(32px,4.4vw,58px)] text-[var(--text-primary)]">
                  {projects.heading}
                </h2>
                <p className="mt-1.5 max-w-[54ch] text-xs leading-relaxed text-[var(--text-on-secondary)] sm:text-sm">
                  {projects.subtitle}
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Filter projects by discipline"
                className="ed-control ed-light-paper inline-flex shrink-0 items-center overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]"
              >
                {filterButtons.map((btn, idx) => {
                  const active = workFilter === btn.id;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        if (window.scrollY > metricsRef.current.railTop + 16) {
                          pendingRailAnchorRef.current = true;
                        }
                        setWorkFilter(btn.id);
                      }}
                      className={`ed-mono min-h-[38px] cursor-pointer whitespace-nowrap px-4 py-2 transition-colors duration-150 ${
                        idx > 0 ? "border-l border-[var(--border)]" : ""
                      } ${
                        active
                          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                          : "text-[var(--text-primary)] hover:bg-[var(--accent-secondary-soft)] hover:text-[var(--accent-secondary-hover)]"
                      }`}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Non-Wrapping Horizontal Editorial Track Measured to Exact Overflow Width */}
            <div className="ed-rail-viewport shrink-0">
              <div ref={railTrackRef} className="ed-rail-track">
                {filteredProjects.map((project) => (
                  <article key={project.id} className="ed-project-card">
                    <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2">
                      <span className="ed-mono text-[var(--text-secondary)]">
                        {project.index}
                      </span>
                      <span className="ed-mono truncate text-[var(--text-muted)]">
                        {project.yearNote}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedProject(project)}
                      aria-label={`Open project dossier for ${project.name}`}
                      className="group relative h-[clamp(120px,20svh,190px)] w-full shrink-0 cursor-pointer overflow-hidden border-b border-[var(--border)] bg-[var(--bg-surface-soft)] text-left"
                    >
                      {project.previewImage ? (
                        <img
                          src={project.previewImage}
                          alt={`${project.name} preview`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <ProjectPlateCanvas kind={project.plateGeometry} />
                      )}
                      <span className="ed-mono ed-control absolute right-2.5 bottom-2.5 border border-[var(--border-strong)] bg-[var(--bg-card)] px-2.5 py-1 text-[var(--text-primary)] transition-colors duration-150 group-hover:border-[var(--accent-secondary)] group-hover:text-[var(--accent-secondary)]">
                        DOSSIER ↗
                      </span>
                    </button>

                    <div className="flex flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
                      <div>
                        <p className="ed-mono text-[var(--text-secondary)]">
                          {project.category}
                        </p>
                        <h3 className="ed-display mt-1.5 text-[clamp(24px,2.3vw,32px)] text-[var(--text-primary)]">
                          {project.name}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                          {project.subtitle}
                        </p>
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--text-muted)] sm:text-[13px]">
                          {project.description}
                        </p>
                      </div>

                      <div className="space-y-2.5 border-t border-[var(--border)] pt-3">
                        <p className="ed-mono truncate text-[var(--text-muted)]">
                          {project.technologies.join(" · ")}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3.5">
                            {project.liveUrl && (
                              <a
                                href={project.liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ed-mono text-[var(--accent)] transition-opacity duration-150 hover:opacity-75"
                              >
                                LIVE ↗
                              </a>
                            )}
                            {project.githubUrl && (
                              <a
                                href={project.githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ed-mono text-[var(--text-primary)] transition-colors duration-150 hover:text-[var(--accent-secondary)]"
                              >
                                GITHUB ↗
                              </a>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedProject(project)}
                            className="ed-mono cursor-pointer text-[var(--text-secondary)] underline decoration-[var(--accent-secondary-border)] underline-offset-4 transition-colors duration-150 hover:text-[var(--accent-secondary-hover)] hover:decoration-[var(--accent-secondary-hover)]"
                          >
                            DETAILS
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Hairline Progress Meter with Burgundy Fill */}
            <div className="mx-auto w-full max-w-[1440px] shrink-0 px-5 sm:px-8">
              <div className="flex items-center justify-between pb-2">
                <span className="ed-mono text-[var(--text-on-secondary)]">
                  01 — 0{filteredProjects.length} SELECTED WORK
                </span>
                <span className="ed-mono text-[var(--text-secondary)]">
                  {railStatic
                    ? "SHOWING ALL MATCHING WORK"
                    : "SCROLL TO WALK THE RAIL →"}
                </span>
              </div>
              <div
                className="h-[2px] w-full bg-[var(--border-on-secondary)]"
                aria-hidden="true"
              >
                <div className="ed-rail-meter-fill" />
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            STAGE 4: THINGS I WORK WITH — STABLE STICKY TECHNICAL DOSSIER
            (Primary Surface, Naturally Scrolling Left Items + Sticky Right Dossier)
            ================================================================ */}
        <section
          id="expertise"
          ref={artifactStageRef}
          aria-label="Skills Experience and Education Dossier"
          className="ed-anchor-offset ed-stage-artifact ed-olive-surface px-5 py-20 sm:px-8 sm:py-24"
        >
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left Scrolling Column: Header & Four Sequential Phase Items */}
            <div className="lg:col-span-6">
              <p className="ed-mono text-[var(--text-secondary)]">
                {expertise.label} · {experience.label} · {education.label}
              </p>

              <h2 className="ed-display mt-3 text-[clamp(34px,4.8vw,64px)] text-[var(--text-primary)]">
                {expertise.heading}
              </h2>

              <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
                {expertise.note}
              </p>

              {/* Four Cumulative Phase Cues Scrolling Past the Sticky Dossier */}
              <ol className="mt-8 space-y-4">
                {artifactPhases.map((phase, idx) => {
                  const isLit = idx <= artifactPhase;
                  const isCurrent = idx === artifactPhase;
                  return (
                    <li
                      key={phase.cueCode}
                      ref={(el) => {
                        artifactItemRefs.current[idx] = el;
                      }}
                      data-lit={isLit ? "true" : "false"}
                      data-current={isCurrent ? "true" : "false"}
                      className="ed-cue"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          lastArtifactPhaseRef.current = idx;
                          setArtifactPhase(idx);
                          document.documentElement.style.setProperty(
                            "--packet-meter",
                            ((idx + 1) / artifactPhases.length).toFixed(4)
                          );
                          const itemMid =
                            metricsRef.current.artifactItemMids[idx];
                          if (typeof itemMid === "number") {
                            const targetY = Math.max(
                              0,
                              itemMid - window.innerHeight * 0.48
                            );
                            if (Math.abs(window.scrollY - targetY) > 24) {
                              scrollTo(targetY, { duration: 0.5 });
                            }
                          }
                        }}
                        aria-current={isCurrent ? "step" : undefined}
                        className="flex w-full cursor-pointer flex-col justify-between p-5 text-left sm:p-6 lg:min-h-[156px]"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span
                            className={`ed-mono ${
                              isLit
                                ? "text-[var(--accent)]"
                                : "text-[var(--text-muted)]"
                            }`}
                          >
                            {phase.cueCode} / {phase.cueTitle}
                          </span>
                          <span
                            className={`ed-mono shrink-0 ${
                              isCurrent
                                ? "text-[var(--accent)]"
                                : "text-[var(--text-muted)]"
                            }`}
                          >
                            {isCurrent
                              ? "ACTIVE"
                              : isLit
                                ? "LOGGED"
                                : `PHASE 0${idx + 1}`}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
                          {phase.cueNote}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Right Sticky Column: Live Status Meter & Unbroken Technical Dossier */}
            <div className="flex flex-col items-center lg:sticky lg:top-24 lg:col-span-6 lg:self-start">
              <div className="w-full max-w-[360px] lg:max-w-[min(360px,44svh)]">
                {/* Live Status Line */}
                <div className="mb-4 border-y border-[var(--border)] py-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <span
                      className="ed-mono truncate text-[var(--text-secondary)]"
                      aria-live="polite"
                    >
                      {currentPhase.statusLine}
                    </span>
                    <span className="ed-mono shrink-0 text-[var(--text-muted)]">
                      PHASE 0{artifactPhase + 1} / 04
                    </span>
                  </div>
                  <div
                    className="mt-2 h-[2px] w-full bg-[var(--border)]"
                    aria-hidden="true"
                  >
                    <div className="ed-packet-meter-fill" />
                  </div>
                </div>

                {/* Printed Paper Technical Dossier Card (Stable & Unbroken Through Final Item) */}
                <div className="ed-packet-paper">
                  {/* Dossier Header Slip */}
                  <div className="border-b border-[var(--border)] bg-[var(--bg-card)] px-4 pt-3.5 pb-3">
                    <p className="ed-mono text-[var(--text-muted)]">
                      {identity.name} · {identity.location}
                    </p>
                    <p className="ed-display-caps mt-1 text-[clamp(24px,3vw,36px)] text-[var(--text-primary)]">
                      TECHNICAL DOSSIER
                    </p>
                  </div>

                  {/* Center Architectural Blueprint Plate */}
                  <div className="relative flex-1 overflow-hidden border-b border-[var(--border)] bg-[var(--bg-surface-soft)]">
                    <ProjectPlateCanvas kind="dossier" />
                  </div>

                  {/* Three Progressive Mono Specification Rows (Real Portfolio Facts Only) */}
                  <dl className="divide-y divide-[var(--border)] bg-[var(--bg-card)] px-4 py-1">
                    <div className="flex items-center justify-between gap-2 py-2">
                      <dt className="ed-mono shrink-0 text-[var(--text-muted)]">
                        TOOLKIT
                      </dt>
                      <dd className="ed-mono truncate text-right text-[var(--text-secondary)]">
                        {currentPhase.toolkitValue}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-2">
                      <dt className="ed-mono shrink-0 text-[var(--text-muted)]">
                        EXPERIENCE
                      </dt>
                      <dd
                        className={`ed-mono truncate text-right ${
                          artifactPhase >= 2
                            ? "text-[var(--text-secondary)]"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        {currentPhase.experienceValue}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-2">
                      <dt className="ed-mono shrink-0 text-[var(--text-muted)]">
                        EDUCATION
                      </dt>
                      <dd
                        className={`ed-mono truncate text-right ${
                          artifactPhase >= 3
                            ? "text-[var(--text-secondary)]"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        {currentPhase.educationValue}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            NORMAL BAND: FULL RULED EXPERTISE, EXPERIENCE & EDUCATION INDEX
            (Secondary Surface — Champagne Light / Dark Burgundy Dark)
            ================================================================ */}
        <section
          ref={indexBandRef}
          aria-label="Full Expertise Index"
          className="ed-olive-surface border-t border-[var(--border-on-secondary)] bg-[var(--bg-secondary)] px-5 py-20 sm:px-8 sm:py-24"
        >
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-col justify-between gap-6 border-b border-[var(--border-on-secondary)] pb-8 md:flex-row md:items-end">
              <div>
                <p className="ed-mono text-[var(--text-secondary)]">
                  {expertise.label}
                </p>
                <h2 className="ed-display mt-3 text-[clamp(36px,5vw,68px)] text-[var(--text-primary)]">
                  {expertise.heading}
                </h2>
              </div>
              <p className="max-w-[44ch] text-sm leading-relaxed text-[var(--text-on-secondary)]">
                {expertise.note}
              </p>
            </div>

            <div className="divide-y divide-[var(--border-on-secondary)] border-b border-[var(--border-on-secondary)]">
              {expertise.groups.map((group) => (
                <div
                  key={group.index}
                  className="grid grid-cols-1 gap-4 py-7 transition-colors duration-150 hover:bg-[var(--accent-secondary-soft)] md:grid-cols-12 md:items-baseline md:px-4"
                >
                  <div className="flex items-baseline gap-4 md:col-span-4">
                    <span className="ed-mono text-[var(--text-secondary)]">
                      {group.index}
                    </span>
                    <h3 className="ed-display text-[clamp(26px,2.5vw,34px)] text-[var(--text-primary)]">
                      {group.title}
                    </h3>
                  </div>

                  <p className="text-sm leading-relaxed text-[var(--text-on-secondary)] md:col-span-4">
                    {group.subtitle}
                  </p>

                  <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 md:col-span-4 md:justify-end">
                    {group.items.map((tool, tIdx) => (
                      <li
                        key={tool}
                        className="ed-mono inline-flex items-center gap-2.5 text-[var(--text-primary)]"
                      >
                        <span>{tool}</span>
                        {tIdx < group.items.length - 1 && (
                          <span
                            className="text-[var(--accent-secondary)]"
                            aria-hidden="true"
                          >
                            ·
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Experience & Education Side-by-Side Ruled Spread */}
            <div className="mt-20 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-12">
              {/* 04 / EXPERIENCE */}
              <div
                id="experience"
                ref={experienceRef}
                className="ed-anchor-offset lg:col-span-6"
              >
                <p className="ed-mono text-[var(--text-secondary)]">
                  {experience.label}
                </p>
                <h2 className="ed-display mt-3 text-[clamp(32px,4.2vw,54px)] text-[var(--text-primary)]">
                  {experience.heading}
                </h2>

                <div className="mt-8 space-y-6">
                  {experience.items.map((role) => (
                    <article
                      key={`${role.organization}-${role.duration}`}
                      className="ed-card p-6 sm:p-8"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-4">
                        <span className="ed-mono text-[var(--text-secondary)]">
                          {role.duration}
                        </span>
                        <span className="ed-mono text-[var(--text-muted)]">
                          {role.type}
                        </span>
                      </div>

                      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="ed-display text-[clamp(30px,3.2vw,42px)] text-[var(--text-primary)]">
                          {role.organization}
                        </h3>
                        <span className="ed-mono text-[var(--text-muted)]">
                          {role.legalEntity}
                        </span>
                      </div>

                      <p className="mt-3 text-base font-medium text-[var(--text-primary)]">
                        {role.position}
                      </p>

                      {role.notes.length > 0 && (
                        <ul className="mt-5 space-y-2 border-t border-[var(--border)] pt-5">
                          {role.notes.map((note, nIdx) => (
                            <li
                              key={nIdx}
                              className="text-sm leading-relaxed text-[var(--text-muted)]"
                            >
                              {note}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </div>

              {/* 05 / EDUCATION */}
              <div id="education" className="ed-anchor-offset lg:col-span-6">
                <p className="ed-mono text-[var(--text-secondary)]">
                  {education.label}
                </p>
                <h2 className="ed-display mt-3 text-[clamp(32px,4.2vw,54px)] text-[var(--text-primary)]">
                  {education.shortInstitution}
                </h2>

                <article className="ed-card mt-8 p-6 sm:p-8">
                  <p className="ed-mono text-[var(--text-secondary)]">
                    INSTITUTION
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
                    {education.institution}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--text-muted)] sm:text-base">
                    {education.degree}
                  </p>

                  <dl className="mt-6 grid grid-cols-2 gap-6 border-t border-[var(--border)] pt-6">
                    <div>
                      <dt className="ed-mono text-[var(--text-muted)]">
                        CURRENT YEAR
                      </dt>
                      <dd className="ed-display mt-2 text-2xl text-[var(--text-primary)] sm:text-3xl">
                        {education.currentYear}
                      </dd>
                    </div>
                    <div className="border-l border-[var(--border)] pl-6">
                      <dt className="ed-mono text-[var(--text-muted)]">
                        EXPECTED GRADUATION
                      </dt>
                      <dd className="ed-display mt-2 text-2xl text-[var(--accent)] sm:text-3xl">
                        {education.expectedGraduation}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            NORMAL BAND: 06 / CURRENTLY EXPLORING (Primary Surface, Click-to-Activate)
            ================================================================ */}
        <section
          id="exploring"
          aria-label="Currently Exploring"
          className="ed-anchor-offset ed-olive-surface border-t border-[var(--border)] bg-[var(--bg-primary)] px-5 py-20 sm:px-8 sm:py-24"
        >
          <div className="mx-auto max-w-[1440px]">
            <p className="ed-mono text-[var(--text-secondary)]">
              {exploring.label}
            </p>
            <h2 className="ed-display mt-3 text-[clamp(36px,5vw,68px)] text-[var(--text-primary)]">
              {exploring.heading}
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
              {/* Active Study Paper Card (Always Visible, Updated Strictly on Click) */}
              <div
                id="active-study-panel"
                role="tabpanel"
                aria-labelledby={`study-tab-${activeTopic.index}`}
                className="ed-card flex flex-col justify-between p-7 sm:p-9 lg:col-span-5"
              >
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <span className="ed-mono text-[var(--text-muted)]">
                    ACTIVE STUDY
                  </span>
                  <span className="ed-mono text-[var(--text-secondary)]">
                    {activeTopic.index} / 0{exploring.topics.length}
                  </span>
                </div>

                <div
                  key={activeTopic.index}
                  className="ed-study-swap my-8 min-h-[140px]"
                >
                  <h3 className="ed-display text-[clamp(30px,3.4vw,44px)] text-[var(--text-primary)]">
                    {activeTopic.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-[var(--text-muted)]">
                    {activeTopic.note}
                  </p>
                </div>

                <p className="ed-mono border-t border-[var(--border)] pt-4 text-[var(--text-muted)]">
                  SELECT ANY AREA OF INQUIRY TO READ NOTES
                </p>
              </div>

              {/* Click-to-Activate Ruled Index (Clean Hairline Framing, No Thick Left Stripe) */}
              <div
                role="tablist"
                aria-label="Areas of current exploration"
                aria-orientation="vertical"
                className="space-y-2.5 lg:col-span-7"
              >
                {exploring.topics.map((topic, idx) => {
                  const isSelected = idx === activeTopicIndex;
                  return (
                    <button
                      key={topic.index}
                      id={`study-tab-${topic.index}`}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-controls="active-study-panel"
                      onClick={() => setActiveTopicIndex(idx)}
                      className={`ed-control flex w-full cursor-pointer items-baseline justify-between gap-6 border px-5 py-4 text-left transition-all duration-150 ${
                        isSelected
                          ? "ed-light-paper border-[var(--accent)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]"
                          : "border-[var(--border)] bg-transparent hover:border-[var(--border-strong)] hover:bg-[var(--accent-secondary-soft)]"
                      }`}
                    >
                      <div className="flex items-baseline gap-5">
                        <span
                          className={`ed-mono ${
                            isSelected
                              ? "text-[var(--accent)]"
                              : "text-[var(--text-muted)]"
                          }`}
                        >
                          {topic.index}
                        </span>
                        <span className="ed-display text-[clamp(24px,2.5vw,32px)] text-[var(--text-primary)]">
                          {topic.title}
                        </span>
                      </div>

                      {isSelected && (
                        <span className="ed-mono hidden shrink-0 text-[var(--accent)] sm:inline">
                          READING
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            STAGE 5: CLOSING STAGE — GENERATIVE CONTOUR VISUAL (165svh, Secondary Surface)
            07 / BEYOND THE CODE (Three Existing Editorial Chapters)
            ================================================================ */}
        <section
          id="beyond"
          ref={seasonStageRef}
          aria-label="Beyond The Code"
          className="ed-stage ed-stage-season ed-olive-surface"
        >
          <div className="ed-stage-inner flex flex-col justify-center gap-6 px-5 pt-20 pb-8 sm:gap-8 sm:px-8">
            {/* 22 Stacked Sine + Harmonic Contour Lines Parallaxed on --season-y & --season-scale */}
            <div className="ed-season-canvas-wrap">
              <ContourFieldCanvas />
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between border-b border-[var(--border-on-secondary)] pb-3">
              <span className="ed-mono text-[var(--text-secondary)]">
                {beyondCode.label}
              </span>
              <span className="ed-mono text-[var(--text-on-secondary)]">
                CHAPTER 0{seasonChapter + 1} / 03
              </span>
            </div>

            {/* Headline, Quote & Three Editorial Chapters */}
            <div className="relative z-10 mx-auto w-full max-w-[1440px]">
              <h2 className="ed-display max-w-[20ch] text-[clamp(32px,5.2vw,74px)] text-[var(--text-primary)]">
                {beyondCode.heading}
              </h2>
              <p className="ed-control ed-light-paper mt-3 max-w-[62ch] border border-[var(--border)] bg-[var(--bg-card)]/95 px-4 py-2.5 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-card)] sm:text-sm">
                &ldquo;{beyondCode.quote}&rdquo;
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3.5 md:mt-7 md:grid-cols-3 md:gap-6">
                {beyondCode.pillars.map((pillar, idx) => {
                  const isActive = idx === seasonChapter;
                  return (
                    <article
                      key={pillar.index}
                      data-active={isActive ? "true" : "false"}
                      className="ed-chapter px-5 py-4 md:p-5"
                    >
                      <span className="ed-mono text-[var(--text-secondary)]">
                        {pillar.index} / CHAPTER 0{idx + 1}
                      </span>
                      <h3 className="ed-display mt-2 text-[clamp(22px,2.3vw,30px)] text-[var(--text-primary)] md:mt-2.5">
                        {pillar.title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)] md:mt-2.5 md:text-sm">
                        {pillar.detail}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            NORMAL BAND: 08 / CONNECT (Primary Surface)
            ================================================================ */}
        <section
          id="contact"
          ref={contactRef}
          aria-label="Contact Atharva Patel"
          className="ed-anchor-offset ed-olive-surface border-t border-[var(--border)] bg-[var(--bg-primary)] px-5 pt-20 pb-20 text-[var(--text-primary)] sm:px-8 sm:pt-24 sm:pb-24"
        >
          <div className="mx-auto max-w-[1440px]">
            <p className="ed-mono text-[var(--text-secondary)]">
              {contact.label}
            </p>
            <h2 className="ed-display mt-3 max-w-[18ch] text-[clamp(40px,6vw,86px)] text-[var(--text-primary)]">
              {contact.heading}
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-10 border-t border-[var(--border)] pt-12 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8">
                <p className="max-w-[58ch] text-base leading-relaxed text-[var(--text-muted)]">
                  {contact.message}
                </p>

                <div className="mt-10">
                  <p className="ed-mono text-[var(--text-secondary)]">
                    DIRECT EMAIL
                  </p>
                  <a
                    href={`mailto:${identity.email}`}
                    className="ed-display ed-email-link mt-3 inline-block break-all border-b border-[var(--accent)] pb-1 text-[clamp(26px,4vw,54px)] text-[var(--text-primary)] transition-colors duration-200 hover:text-[var(--accent)]"
                  >
                    {identity.email}
                  </a>
                </div>
              </div>

              <div className="flex flex-col items-start gap-5 lg:col-span-4 lg:items-end">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  aria-live="polite"
                  className="ed-mono ed-control min-h-[44px] cursor-pointer whitespace-nowrap border border-[var(--accent)] bg-[var(--accent)] px-6 py-3 text-[var(--accent-fg)] transition-colors duration-200 hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]"
                >
                  {copiedEmail ? "EMAIL COPIED ✓" : "COPY EMAIL ADDRESS"}
                </button>

                <div className="flex items-center gap-6">
                  <a
                    href={identity.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ed-mono text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)]"
                  >
                    GITHUB ↗
                  </a>
                  <a
                    href={identity.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ed-mono text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)]"
                  >
                    LINKEDIN ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Editorial Footer */}
      <footer
        ref={footerRef}
        className="ed-olive-surface border-t border-[var(--border-on-secondary)] bg-[var(--bg-secondary)] px-5 pt-14 pb-16 text-[var(--text-primary)] sm:px-8"
      >
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col justify-between gap-10 border-b border-[var(--border-on-secondary)] pb-12 md:flex-row md:items-end">
            <div>
              <div className="ed-display-caps text-[clamp(40px,6.5vw,88px)]">
                <span className="text-[var(--text-primary)]">ATHARVA</span>{" "}
                <span className="ed-brand-italic italic text-[var(--accent)]">
                  PATEL
                </span>
              </div>
              <p className="ed-mono mt-4 max-w-[54ch] text-[var(--text-on-secondary)]">
                {footer.tagline}
              </p>
            </div>

            <div className="flex flex-col items-start gap-5 md:items-end">
              <div className="flex flex-wrap gap-x-5 gap-y-2 md:justify-end">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="ed-mono text-[var(--text-primary)] transition-colors duration-150 hover:text-[var(--accent-secondary)]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              <button
                type="button"
                onClick={() => scrollTo(0, { duration: 0.9 })}
                className="ed-mono ed-control ed-btn-on-olive min-h-[42px] cursor-pointer border border-[var(--accent-secondary-border)] bg-[var(--bg-card)] px-5 py-2 text-[var(--accent-secondary)] transition-colors duration-150 hover:border-[var(--accent-secondary)] hover:bg-[var(--accent-secondary-soft)] hover:text-[var(--accent-secondary-hover)]"
              >
                BACK TO TOP ↑
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="ed-mono text-[var(--text-on-secondary)]">
              &copy; {footer.copyrightYear} {identity.shortName}. ALL RIGHTS
              RESERVED.
            </p>
            <p className="ed-mono text-[var(--text-on-secondary)]">
              {identity.location}
            </p>
          </div>
        </div>
      </footer>

      {/* Preserved Interactive Project Dossier Lightbox Modal */}
      {selectedProject && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--bg-scrim)] p-4 backdrop-blur-[3px] sm:p-8"
          onClick={() => setSelectedProject(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-dossier-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            data-lenis-prevent=""
            className="ed-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 shadow-[var(--shadow-modal)] sm:p-10"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
              <div>
                <p className="ed-mono text-[var(--text-secondary)]">
                  PROJECT {selectedProject.index} · {selectedProject.category}
                </p>
                <h3
                  id="project-dossier-title"
                  className="ed-display mt-2 text-[clamp(32px,4vw,46px)] text-[var(--text-primary)]"
                >
                  {selectedProject.name}
                </h3>
                <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                  {selectedProject.subtitle}
                </p>
              </div>
              <button
                ref={modalCloseBtnRef}
                type="button"
                onClick={() => setSelectedProject(null)}
                aria-label="Close project dossier"
                className="ed-mono ed-control inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-[var(--accent-secondary-border)] bg-[var(--bg-primary)] text-[var(--accent-secondary)] transition-colors duration-150 hover:border-[var(--accent-secondary)] hover:bg-[var(--accent-secondary-soft)] hover:text-[var(--accent-secondary-hover)]"
              >
                ✕
              </button>
            </div>

            <div className="ed-control relative mt-6 aspect-[16/9] w-full overflow-hidden border border-[var(--border)] bg-[var(--bg-surface-soft)]">
              {selectedProject.previewImage ? (
                <img
                  src={selectedProject.previewImage}
                  alt={`${selectedProject.name} preview`}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ProjectPlateCanvas kind={selectedProject.plateGeometry} />
              )}
            </div>

            <div className="mt-6 space-y-4">
              <p className="text-sm leading-relaxed text-[var(--text-primary)] sm:text-base">
                {selectedProject.description}
              </p>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                {selectedProject.architectureNote}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-5">
              <p className="ed-mono text-[var(--text-muted)]">
                {selectedProject.technologies.join(" · ")}
              </p>
              <div className="flex flex-wrap items-center gap-5">
                {selectedProject.liveUrl && (
                  <a
                    href={selectedProject.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ed-mono text-[var(--accent)] transition-opacity duration-150 hover:opacity-75"
                  >
                    VISIT LIVE ↗
                  </a>
                )}
                {selectedProject.githubUrl && (
                  <a
                    href={selectedProject.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ed-mono text-[var(--text-primary)] transition-colors duration-150 hover:text-[var(--accent-secondary)]"
                  >
                    GITHUB ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SmoothScrollProvider
        options={{
          lerp: 0.135,
          duration: 0.85,
          wheelMultiplier: 1.0,
          anchorOffset: 0,
          anchors: true,
          allowNestedScroll: true,
          respectReducedMotion: true,
        }}
      >
        <PortfolioExperience />
      </SmoothScrollProvider>
    </ThemeProvider>
  );
}
