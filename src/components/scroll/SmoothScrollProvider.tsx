import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  SmoothScrollEngine,
  type ScrollToOptions,
  type SmoothScrollOptions,
  type SmoothScrollSnapshot,
} from "../../lib/smooth-scroll/engine";

interface SmoothScrollContextValue {
  engine: SmoothScrollEngine | null;
  scrollTo: (
    target: number | string | HTMLElement,
    options?: ScrollToOptions
  ) => void;
  stop: () => void;
  start: () => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  engine: null,
  scrollTo: (target) => {
    if (typeof target === "number") {
      window.scrollTo({ top: target, behavior: "smooth" });
    } else if (typeof target === "string") {
      document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth" });
    }
  },
  stop: () => {},
  start: () => {},
});

const DEFAULT_SNAPSHOT: SmoothScrollSnapshot = {
  scroll: 0,
  targetScroll: 0,
  limit: 0,
  progress: 0,
  velocity: 0,
  direction: 0,
  isScrolling: false,
  isStopped: false,
  prefersReducedMotion: false,
};

interface SmoothScrollProviderProps {
  children: ReactNode;
  options?: SmoothScrollOptions;
}

export function SmoothScrollProvider({
  children,
  options,
}: SmoothScrollProviderProps) {
  const [engine, setEngine] = useState<SmoothScrollEngine | null>(null);

  useEffect(() => {
    const instance = new SmoothScrollEngine(options);
    setEngine(instance);
    return () => {
      instance.destroy();
      setEngine(null);
    };
    // Initialize once on mount with portfolio configuration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue = useMemo<SmoothScrollContextValue>(
    () => ({
      engine,
      scrollTo: (target, scrollOptions) => {
        if (engine) {
          engine.scrollTo(target, scrollOptions);
        } else if (typeof target === "number") {
          window.scrollTo({ top: target, behavior: "smooth" });
        } else if (typeof target === "string") {
          document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
        } else {
          target.scrollIntoView({ behavior: "smooth" });
        }
      },
      stop: () => engine?.stop(),
      start: () => engine?.start(),
    }),
    [engine]
  );

  return (
    <SmoothScrollContext.Provider value={contextValue}>
      {children}
    </SmoothScrollContext.Provider>
  );
}

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

/**
 * React 19 tear-free scroll state subscription using useSyncExternalStore
 * (matching Lenis v2 React architecture).
 */
export function useScrollSnapshot(): SmoothScrollSnapshot {
  const { engine } = useSmoothScroll();

  return useSyncExternalStore(
    (onStoreChange) => (engine ? engine.subscribe(onStoreChange) : () => {}),
    () => (engine ? engine.getSnapshot() : DEFAULT_SNAPSHOT),
    () => DEFAULT_SNAPSHOT
  );
}

/**
 * Zero-re-render imperative scroll listener for high-frequency DOM/WebGL syncing.
 */
export function useSmoothScrollEffect(
  callback: (snapshot: SmoothScrollSnapshot) => void
) {
  const { engine } = useSmoothScroll();

  useEffect(() => {
    if (!engine) return;
    callback(engine.getSnapshot());
    return engine.subscribe(callback);
  }, [engine, callback]);
}
