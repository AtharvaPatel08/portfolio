import { memo, useRef, useState, type KeyboardEvent } from "react";
import { PORTFOLIO_DATA } from "../../data/portfolio";

export const ExploringSection = memo(function ExploringSection() {
  const { exploring } = PORTFOLIO_DATA;
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeTopic = exploring.topics[activeTopicIndex] ?? exploring.topics[0];

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    const count = exploring.topics.length;
    let nextIdx: number | null = null;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIdx = (idx + 1) % count;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIdx = (idx - 1 + count) % count;
    } else if (event.key === "Home") {
      nextIdx = 0;
    } else if (event.key === "End") {
      nextIdx = count - 1;
    }

    if (nextIdx !== null) {
      event.preventDefault();
      setActiveTopicIndex(nextIdx);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <section
      id="exploring"
      aria-label="Currently Exploring"
      className="ed-anchor-offset border-t border-[var(--hairline)] bg-[var(--cream)] px-5 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto max-w-[1440px]">
        <p className="ed-mono text-[var(--muted)]">{exploring.label}</p>
        <h2 className="ed-display mt-3 text-[clamp(34px,5vw,68px)] text-[var(--ink)]">
          {exploring.heading}
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
          {/* Active Study Paper Card (Always Visible, Updated Strictly on Click / Keyboard) */}
          <div
            id="active-study-panel"
            role="tabpanel"
            aria-labelledby={`study-tab-${activeTopic.index}`}
            className="flex flex-col justify-between border-[1.5px] border-[var(--ink)] bg-[var(--paper)] p-7 sm:p-9 lg:col-span-5"
          >
            <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-4">
              <span className="ed-mono text-[var(--muted)]">ACTIVE STUDY</span>
              <span className="ed-mono text-[var(--red)]">
                {activeTopic.index} / 0{exploring.topics.length}
              </span>
            </div>

            <div
              key={activeTopic.index}
              className="ed-study-swap my-8 min-h-[156px]"
            >
              <h3 className="ed-display text-[clamp(28px,3.2vw,42px)] text-[var(--ink)]">
                {activeTopic.title}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
                {activeTopic.note}
              </p>
            </div>

            <p className="ed-mono border-t border-[var(--hairline)] pt-4 text-[var(--muted)]">
              SELECT ANY AREA OF INQUIRY TO READ NOTES
            </p>
          </div>

          {/* Click-to-Activate Ruled Index (Zero Hover Flicker, Full Keyboard Tablist Support) */}
          <div
            role="tablist"
            aria-label="Areas of current exploration"
            aria-orientation="vertical"
            className="divide-y divide-[var(--hairline)] border-y border-[var(--hairline)] lg:col-span-7"
          >
            {exploring.topics.map((topic, idx) => {
              const isSelected = idx === activeTopicIndex;
              return (
                <button
                  key={topic.index}
                  ref={(el) => {
                    tabRefs.current[idx] = el;
                  }}
                  id={`study-tab-${topic.index}`}
                  type="button"
                  role="tab"
                  tabIndex={isSelected ? 0 : -1}
                  aria-selected={isSelected}
                  aria-controls="active-study-panel"
                  onClick={() => setActiveTopicIndex(idx)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`flex w-full cursor-pointer items-baseline justify-between gap-6 border-l-2 px-4 py-5 text-left transition-colors duration-200 ${
                    isSelected
                      ? "border-l-[var(--red)] bg-[var(--paper)]"
                      : "border-l-transparent hover:bg-[var(--paper)]/60"
                  }`}
                >
                  <div className="flex items-baseline gap-5">
                    <span
                      className={`ed-mono shrink-0 ${
                        isSelected
                          ? "text-[var(--red)]"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {topic.index}
                    </span>
                    <span className="ed-display text-[clamp(22px,2.4vw,32px)] text-[var(--ink)]">
                      {topic.title}
                    </span>
                  </div>

                  {isSelected && (
                    <span className="ed-mono hidden shrink-0 text-[var(--red)] sm:inline">
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
  );
});
