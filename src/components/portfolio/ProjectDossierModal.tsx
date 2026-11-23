import { memo, useEffect, useRef } from "react";
import type { ProjectItem } from "../../data/portfolio";
import { ProjectPlateCanvas } from "../canvas/PortfolioCanvases";

interface ProjectDossierModalProps {
  project: ProjectItem | null;
  onClose: () => void;
  onOpenLock: () => void;
  onCloseUnlock: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export const ProjectDossierModal = memo(function ProjectDossierModal({
  project,
  onClose,
  onOpenLock,
  onCloseUnlock,
}: ProjectDossierModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!project) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    onOpenLock();

    const focusTimer = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            !dialogRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      onCloseUnlock();
      triggerRef.current?.focus();
      triggerRef.current = null;
    };
  }, [project, onClose, onOpenLock, onCloseUnlock]);

  if (!project) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--loam)]/80 p-4 backdrop-blur-[2px] sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-dossier-title"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent=""
        className="max-h-[90svh] w-full max-w-2xl overflow-y-auto overscroll-contain border-[1.5px] border-[var(--ink)] bg-[var(--paper)] p-6 text-[var(--ink)] sm:p-10"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] pb-5">
          <div>
            <p className="ed-mono text-[var(--red)]">
              PROJECT {project.index} · {project.category}
            </p>
            <h3
              id="project-dossier-title"
              className="ed-display mt-2 text-[clamp(30px,4vw,46px)] text-[var(--ink)]"
            >
              {project.name}
            </h3>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">
              {project.subtitle}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close project dossier"
            className="ed-mono inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-[var(--ink)] text-[var(--ink)] transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 aspect-[16/9] w-full overflow-hidden border border-[var(--hairline)] bg-[var(--cream)]">
          {project.previewImage ? (
            <img
              src={project.previewImage}
              alt={`${project.name} preview`}
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <ProjectPlateCanvas kind={project.plateGeometry} />
          )}
        </div>

        <div className="mt-6 space-y-4">
          <p className="text-sm leading-relaxed text-[var(--ink)] sm:text-base">
            {project.description}
          </p>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            {project.architectureNote}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--hairline)] pt-5">
          <p className="ed-mono text-[var(--muted)]">
            {project.technologies.join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-5">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ed-mono text-[var(--red)] transition-opacity hover:opacity-75"
              >
                VISIT LIVE ↗
              </a>
            )}
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ed-mono text-[var(--ink)] transition-colors hover:text-[var(--red)]"
              >
                GITHUB ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
