import { memo, useEffect, useRef } from "react";
import type { ProjectItem } from "../../data/portfolio";

export type EditorialPlateKind = ProjectItem["plateGeometry"] | "dossier";

const STROKE_BUCKETS = 8;

const LIGHT_STROKE_COLORS = Array.from({ length: STROKE_BUCKETS }, (_, i) => {
  const alpha = 0.06 + ((i + 0.5) / STROKE_BUCKETS) * 0.12;
  // Subtle Rich Burgundy glint on the cresting shimmer buckets, Deep Muted Olive base
  if (i >= STROKE_BUCKETS - 2) {
    return `rgba(116, 31, 54, ${(alpha * 0.92).toFixed(3)})`;
  }
  return `rgba(99, 107, 47, ${alpha.toFixed(3)})`;
});

const DARK_STROKE_COLORS = Array.from({ length: STROKE_BUCKETS }, (_, i) => {
  const alpha = 0.22 + ((i + 0.5) / STROKE_BUCKETS) * 0.24;
  return `rgba(94, 18, 36, ${alpha.toFixed(3)})`;
});

function isDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains("dark") ||
    document.documentElement.dataset.theme === "dark"
  );
}

/**
 * Stage 1 Hero Canvas:
 * Full-bleed Burgundy Elegance silk-stroke field adapting live to Light (#F5EEE6)
 * and Dark (#211317) themes. Batches strokes into 8 alpha buckets (~8 draw calls/frame)
 * and pauses automatically offscreen or when the browser tab is hidden.
 */
export const DriftingStrokesCanvas = memo(function DriftingStrokesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;
    const context = canvasNode.getContext("2d", { alpha: false });
    if (!context) return;

    const canvas: HTMLCanvasElement = canvasNode;
    const ctx: CanvasRenderingContext2D = context;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQuery.matches;
    let dark = isDarkMode();
    let isVisible = true;
    let isTabVisible = !document.hidden;
    let rafId = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;

    // Pre-allocated bucket coordinate buffers (zero GC churn per frame)
    const buckets: number[][] = Array.from({ length: STROKE_BUCKETS }, () => []);

    function resize() {
      const parent = canvas.parentElement;
      width = Math.max(parent ? parent.clientWidth : window.innerWidth, 1);
      height = Math.max(parent ? parent.clientHeight : window.innerHeight, 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    function draw(timeSec: number) {
      if (width < 1 || height < 1) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = dark ? "#101010" : "#F5F1E9";
      ctx.fillRect(0, 0, width, height);

      for (let b = 0; b < STROKE_BUCKETS; b++) {
        buckets[b].length = 0;
      }

      const cellX = width < 640 ? 28 : 34;
      const cellY = width < 640 ? 22 : 24;
      const cols = Math.ceil(width / cellX) + 2;
      const rows = Math.ceil(height / cellY) + 2;

      const t52 = timeSec * 0.52;
      const t40 = timeSec * 0.4;
      const t34 = timeSec * 0.34;
      const t68 = timeSec * 0.68;

      for (let r = 0; r < rows; r++) {
        const baseY = r * cellY;
        const rowShift = (r % 2) * (cellX * 0.5);
        const r61 = r * 0.61;
        const r19 = r * 0.19;

        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const phase = idx * 0.37 + r61;
          const driftX = Math.sin(t52 + phase) * 5;
          const driftY = Math.cos(t40 + idx * 0.23) * 2.4;
          const angle = Math.sin(t34 + c * 0.31 + r19) * 0.24 - 0.12;
          const len = 9 + ((Math.sin(idx * 1.13) + 1) * 0.5) * 8;

          const alphaWave = (Math.sin(t68 + idx * 0.29) + 1) * 0.5;
          const bucketIdx = Math.min(
            STROKE_BUCKETS - 1,
            Math.floor(alphaWave * STROKE_BUCKETS)
          );

          const cx = c * cellX + rowShift + driftX - cellX * 0.5;
          const cy = baseY + driftY;
          const half = len * 0.5;
          const dx = Math.cos(angle) * half;
          const dy = Math.sin(angle) * half;

          buckets[bucketIdx].push(cx - dx, cy - dy, cx + dx, cy + dy);
        }
      }

      ctx.lineWidth = 1.15;
      ctx.lineCap = "butt";
      const palette = dark ? DARK_STROKE_COLORS : LIGHT_STROKE_COLORS;

      for (let b = 0; b < STROKE_BUCKETS; b++) {
        const coords = buckets[b];
        if (coords.length === 0) continue;
        ctx.strokeStyle = palette[b];
        ctx.beginPath();
        for (let i = 0; i < coords.length; i += 4) {
          ctx.moveTo(coords[i], coords[i + 1]);
          ctx.lineTo(coords[i + 2], coords[i + 3]);
        }
        ctx.stroke();
      }
    }

    function shouldAnimate() {
      return isVisible && isTabVisible && !reduced;
    }

    function startLoop() {
      if (shouldAnimate() && !rafId) {
        rafId = requestAnimationFrame(tick);
      }
    }

    function stopLoop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function tick(now: number) {
      if (!shouldAnimate()) {
        rafId = 0;
        return;
      }
      draw(now / 1000);
      rafId = requestAnimationFrame(tick);
    }

    resize();
    draw(0);

    const ro = new ResizeObserver(() => {
      resize();
      draw(reduced ? 0 : performance.now() / 1000);
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const mo = new MutationObserver(() => {
      const nextDark = isDarkMode();
      if (nextDark !== dark) {
        dark = nextDark;
        draw(reduced ? 0 : performance.now() / 1000);
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
        if (shouldAnimate()) startLoop();
        else stopLoop();
      },
      { threshold: 0.01 }
    );
    io.observe(canvas);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (shouldAnimate()) startLoop();
      else stopLoop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onReducedChange = (e: MediaQueryListEvent) => {
      reduced = e.matches;
      if (reduced) {
        stopLoop();
        draw(0);
      } else {
        startLoop();
      }
    };
    reducedQuery.addEventListener("change", onReducedChange);

    startLoop();

    return () => {
      stopLoop();
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedQuery.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 block h-full w-full"
    />
  );
});

/**
 * Stage 3 & Stage 4 Architectural Technical Plates:
 * Crisp DPR-aware Burgundy Elegance drafting diagrams adapting live to Light and Dark themes.
 */
export const ProjectPlateCanvas = memo(function ProjectPlateCanvas({
  kind,
  className = "",
}: {
  kind: EditorialPlateKind;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;
    const context = canvasNode.getContext("2d", { alpha: false });
    if (!context) return;

    const canvas: HTMLCanvasElement = canvasNode;
    const ctx: CanvasRenderingContext2D = context;

    function drawPlate() {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw < 16 || ch < 16) return;
      const w = Math.floor(cw);
      const h = Math.floor(ch);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.floor(w * dpr);
      const targetH = Math.floor(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const dark = isDarkMode();
      const plateGround = dark ? "#101010" : "#EFE9DD";
      const gridColor = dark
        ? "rgba(214, 185, 154, 0.08)"
        : "rgba(99, 107, 47, 0.11)";
      const paperInset = dark ? "#1A1A1A" : "#FAF7F1";
      const subPanel = dark ? "#151515" : "#EBE4D7";
      const inkColor = dark ? "#F5EEE6" : "#292522";
      const subtleStroke = dark
        ? "rgba(214, 185, 154, 0.42)"
        : "rgba(99, 107, 47, 0.52)";
      const faintStroke = dark
        ? "rgba(214, 185, 154, 0.24)"
        : "rgba(41, 37, 34, 0.22)";
      const accentColor = dark ? "#5E1224" : "#741F36";
      const accentWash = dark
        ? "rgba(94, 18, 36, 0.42)"
        : "rgba(116, 31, 54, 0.14)";
      const barWash = dark
        ? "rgba(214, 185, 154, 0.12)"
        : "rgba(99, 107, 47, 0.16)";
      const chipColor = dark ? "#D6B99A" : "#636B2F";

      // Warm plate ground + fine registration grid
      ctx.fillStyle = plateGround;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      const step = Math.max(18, Math.round(w / 11));
      ctx.beginPath();
      for (let x = step; x < w; x += step) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = step; y < h; y += step) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();

      // Editorial corner registration marks
      const m = 10;
      const cLen = 7;
      ctx.strokeStyle = subtleStroke;
      ctx.lineWidth = 1;
      const corners: [number, number, number, number][] = [
        [m, m, 1, 1],
        [w - m, m, -1, 1],
        [m, h - m, 1, -1],
        [w - m, h - m, -1, -1],
      ];
      ctx.beginPath();
      corners.forEach(([x, y, sx, sy]) => {
        ctx.moveTo(x, y + sy * cLen);
        ctx.lineTo(x, y);
        ctx.lineTo(x + sx * cLen, y);
      });
      ctx.stroke();

      const cx = w * 0.5;
      const cy = h * 0.5;
      const u = Math.min(w, h) * 0.34;

      if (kind === "scratch") {
        const boxW = w * 0.72;
        const boxH = h * 0.62;
        const left = cx - boxW * 0.5;
        const top = cy - boxH * 0.5;

        ctx.fillStyle = paperInset;
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1.25;
        ctx.fillRect(left, top, boxW, boxH);
        ctx.strokeRect(left, top, boxW, boxH);

        const headH = boxH * 0.2;
        ctx.beginPath();
        ctx.moveTo(left, top + headH);
        ctx.lineTo(left + boxW, top + headH);
        ctx.stroke();

        ctx.fillStyle = accentColor;
        ctx.fillRect(left + 10, top + headH * 0.35, 8, 6);

        const pad = 12;
        const paneY = top + headH + pad;
        const paneH = boxH - headH - pad * 2;
        const leftW = (boxW - pad * 3) * 0.38;
        const rightW = (boxW - pad * 3) * 0.62;

        ctx.fillStyle = subPanel;
        ctx.fillRect(left + pad, paneY, leftW, paneH);
        ctx.strokeStyle = subtleStroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(left + pad, paneY, leftW, paneH);

        ctx.fillStyle = paperInset;
        ctx.fillRect(left + pad * 2 + leftW, paneY, rightW, paneH);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(left + pad * 2 + leftW, paneY, rightW, paneH);

        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1.25;
        const rx = left + pad * 2 + leftW + 10;
        ctx.beginPath();
        ctx.moveTo(rx, paneY + paneH * 0.34);
        ctx.lineTo(rx + rightW * 0.55, paneY + paneH * 0.34);
        ctx.moveTo(rx, paneY + paneH * 0.56);
        ctx.lineTo(rx + rightW * 0.72, paneY + paneH * 0.56);
        ctx.stroke();

        ctx.fillStyle = chipColor;
        ctx.fillRect(rx, paneY + paneH * 0.72, rightW * 0.34, 5);
      } else if (kind === "batalarm") {
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1.35;
        ctx.fillStyle = paperInset;
        ctx.beginPath();
        ctx.arc(cx, cy, u * 1.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = subtleStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, u * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        for (let t = 0; t < 12; t++) {
          const a = (t / 12) * Math.PI * 2;
          const inner = t % 3 === 0 ? u * 0.82 : u * 0.92;
          ctx.strokeStyle = t === 0 ? accentColor : inkColor;
          ctx.lineWidth = t % 3 === 0 ? 1.4 : 1;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
          ctx.lineTo(cx + Math.cos(a) * u * 1.05, cy + Math.sin(a) * u * 1.05);
          ctx.stroke();
        }

        ctx.strokeStyle = faintStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - u * 1.45, cy);
        ctx.lineTo(cx - u * 1.12, cy);
        ctx.moveTo(cx + u * 1.12, cy);
        ctx.lineTo(cx + u * 1.45, cy);
        ctx.stroke();

        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - u * 0.66);
        ctx.stroke();

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + u * 0.56, cy + u * 0.24);
        ctx.stroke();

        ctx.fillStyle = accentColor;
        ctx.fillRect(cx - 3.5, cy - 3.5, 7, 7);
      } else if (kind === "qr") {
        const size = u * 1.95;
        const left = cx - size * 0.5;
        const top = cy - size * 0.5;
        const cells = 9;
        const cell = size / cells;

        ctx.fillStyle = paperInset;
        ctx.fillRect(left - 6, top - 6, size + 12, size + 12);
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1.3;
        ctx.strokeRect(left - 6, top - 6, size + 12, size + 12);

        const drawFinder = (gx: number, gy: number, accentCenter: boolean) => {
          const x = left + gx * cell;
          const y = top + gy * cell;
          ctx.strokeStyle = inkColor;
          ctx.lineWidth = 1.35;
          ctx.strokeRect(x + 1, y + 1, cell * 3 - 2, cell * 3 - 2);
          ctx.fillStyle = accentCenter ? accentColor : inkColor;
          ctx.fillRect(
            x + cell * 0.78,
            y + cell * 0.78,
            cell * 1.44,
            cell * 1.44
          );
        };

        drawFinder(0, 0, true);
        drawFinder(6, 0, false);
        drawFinder(0, 6, false);

        const pattern: [number, number, boolean][] = [
          [4, 0, false],
          [4, 2, false],
          [3, 4, false],
          [4, 4, true],
          [5, 4, false],
          [7, 4, false],
          [8, 4, false],
          [4, 6, false],
          [6, 6, false],
          [7, 7, false],
          [8, 8, true],
          [5, 8, false],
          [6, 8, false],
        ];
        pattern.forEach(([px, py, isAccent]) => {
          ctx.fillStyle = isAccent ? accentColor : chipColor;
          ctx.fillRect(
            left + px * cell + 1.5,
            top + py * cell + 1.5,
            cell - 3,
            cell - 3
          );
        });
      } else if (kind === "data") {
        const padX = w * 0.14;
        const padY = h * 0.2;
        const plotW = w - padX * 2;
        const plotH = h - padY * 2;

        ctx.fillStyle = paperInset;
        ctx.fillRect(padX, padY, plotW, plotH);
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(padX, padY);
        ctx.lineTo(padX, padY + plotH);
        ctx.lineTo(padX + plotW, padY + plotH);
        ctx.stroke();

        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = subtleStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padX, padY + plotH * 0.5);
        ctx.lineTo(padX + plotW, padY + plotH * 0.5);
        ctx.stroke();
        ctx.restore();

        const pts = [0.78, 0.62, 0.68, 0.34, 0.44, 0.2];
        const coords = pts.map((v, idx) => ({
          x: padX + (idx / (pts.length - 1)) * (plotW - 18) + 9,
          y: padY + v * plotH,
        }));

        coords.forEach((p, idx) => {
          ctx.fillStyle = idx === 3 ? accentWash : barWash;
          ctx.fillRect(p.x - 6, p.y, 12, padY + plotH - p.y);
        });

        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        coords.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        const peak = coords[3];
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(peak.x, peak.y);
        ctx.lineTo(peak.x, padY + plotH);
        ctx.stroke();
        ctx.restore();

        coords.forEach((p, idx) => {
          ctx.fillStyle = idx === 3 || idx === 5 ? accentColor : inkColor;
          ctx.fillRect(p.x - 3.5, p.y - 3.5, 7, 7);
        });
      } else {
        const rOuter = u * 1.05;
        const rInner = u * 0.56;

        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1.35;
        ctx.fillStyle = paperInset;
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = subtleStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - rOuter * 1.28, cy);
        ctx.lineTo(cx + rOuter * 1.28, cy);
        ctx.moveTo(cx, cy - rOuter * 1.28);
        ctx.lineTo(cx, cy + rOuter * 1.28);
        ctx.stroke();

        const nodes: [number, number][] = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
          const rad = i % 2 === 0 ? rOuter : rInner;
          nodes.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
        }

        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        nodes.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(nodes[0][0], nodes[0][1]);
        ctx.lineTo(nodes[4][0], nodes[4][1]);
        ctx.moveTo(nodes[2][0], nodes[2][1]);
        ctx.lineTo(nodes[6][0], nodes[6][1]);
        ctx.stroke();

        nodes.forEach(([x, y], i) => {
          ctx.fillStyle = i % 2 === 0 ? inkColor : accentColor;
          ctx.fillRect(x - 3, y - 3, 6, 6);
        });

        ctx.fillStyle = chipColor;
        ctx.fillRect(cx - 7, cy - 7, 14, 14);
        ctx.fillStyle = accentColor;
        ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
      }
    }

    drawPlate();
    const ro = new ResizeObserver(() => drawPlate());
    ro.observe(canvas);

    const mo = new MutationObserver(() => drawPlate());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [kind]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 block h-full w-full ${className}`}
    />
  );
});

/**
 * Stage 5 Closing Stage Canvas:
 * 22 stacked contour waves on Champagne (Light) or Dark Burgundy (Dark),
 * every 5th wave accented in Burgundy / Muted Burgundy.
 */
export const ContourFieldCanvas = memo(function ContourFieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;
    const context = canvasNode.getContext("2d", { alpha: false });
    if (!context) return;

    const canvas: HTMLCanvasElement = canvasNode;
    const ctx: CanvasRenderingContext2D = context;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQuery.matches;
    let dark = isDarkMode();
    let isVisible = true;
    let isTabVisible = !document.hidden;
    let rafId = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;

    function resize() {
      const parent = canvas.parentElement;
      width = Math.max(parent ? parent.clientWidth : window.innerWidth, 1);
      height = Math.max(parent ? parent.clientHeight : window.innerHeight, 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    function draw(timeSec: number) {
      if (width < 1 || height < 1) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = dark ? "#101010" : "#EFE9DD";
      ctx.fillRect(0, 0, width, height);

      const lineCount = 22;
      const topPad = height * 0.08;
      const spanY = height * 0.84;
      const stepX = Math.max(10, Math.floor(width / 96));

      const accentStride = dark ? 5 : 4;

      ctx.beginPath();
      for (let i = 0; i < lineCount; i++) {
        if ((i + 1) % accentStride === 0) continue;
        const baseY = topPad + (i / (lineCount - 1)) * spanY;
        const amp1 = 14 + (i % 4) * 3.5;
        const amp2 = 8 + ((i * 3) % 5) * 2.2;
        const freq1 = 0.0042 + (i % 3) * 0.00045;
        const freq2 = 0.0017 + (i % 4) * 0.00025;
        const phase1 = i * 0.44 + timeSec * 0.34;
        const phase2 = i * 0.29 - timeSec * 0.18;

        for (let x = -stepX; x <= width + stepX; x += stepX) {
          const y =
            baseY +
            Math.sin(x * freq1 + phase1) * amp1 +
            Math.sin(x * freq2 + phase2) * amp2;
          if (x === -stepX) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = dark
        ? "rgba(214, 185, 154, 0.22)"
        : "rgba(99, 107, 47, 0.26)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < lineCount; i++) {
        if ((i + 1) % accentStride !== 0) continue;
        const baseY = topPad + (i / (lineCount - 1)) * spanY;
        const amp1 = 14 + (i % 4) * 3.5;
        const amp2 = 8 + ((i * 3) % 5) * 2.2;
        const freq1 = 0.0042 + (i % 3) * 0.00045;
        const freq2 = 0.0017 + (i % 4) * 0.00025;
        const phase1 = i * 0.44 + timeSec * 0.34;
        const phase2 = i * 0.29 - timeSec * 0.18;

        for (let x = -stepX; x <= width + stepX; x += stepX) {
          const y =
            baseY +
            Math.sin(x * freq1 + phase1) * amp1 +
            Math.sin(x * freq2 + phase2) * amp2;
          if (x === -stepX) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = dark ? "#5E1224" : "#741F36";
      ctx.lineWidth = dark ? 1.75 : 1.55;
      ctx.stroke();
    }

    function shouldAnimate() {
      return isVisible && isTabVisible && !reduced;
    }

    function startLoop() {
      if (shouldAnimate() && !rafId) {
        rafId = requestAnimationFrame(tick);
      }
    }

    function stopLoop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function tick(now: number) {
      if (!shouldAnimate()) {
        rafId = 0;
        return;
      }
      draw(now / 1000);
      rafId = requestAnimationFrame(tick);
    }

    resize();
    draw(0);

    const ro = new ResizeObserver(() => {
      resize();
      draw(reduced ? 0 : performance.now() / 1000);
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const mo = new MutationObserver(() => {
      const nextDark = isDarkMode();
      if (nextDark !== dark) {
        dark = nextDark;
        draw(reduced ? 0 : performance.now() / 1000);
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
        if (shouldAnimate()) startLoop();
        else stopLoop();
      },
      { threshold: 0.01 }
    );
    io.observe(canvas);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (shouldAnimate()) startLoop();
      else stopLoop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onReducedChange = (e: MediaQueryListEvent) => {
      reduced = e.matches;
      if (reduced) {
        stopLoop();
        draw(0);
      } else {
        startLoop();
      }
    };
    reducedQuery.addEventListener("change", onReducedChange);

    startLoop();

    return () => {
      stopLoop();
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedQuery.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="block h-full w-full"
    />
  );
});
