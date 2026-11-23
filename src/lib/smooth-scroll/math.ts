export function clamp(min: number, input: number, max: number): number {
  return Math.max(min, Math.min(input, max));
}

export function lerp(start: number, end: number, factor: number): number {
  return (1 - factor) * start + factor * end;
}

/**
 * Frame-rate independent exponential damping (from Lenis core).
 * Ensures identical inertial feel across 60Hz, 120Hz, and 144Hz displays.
 */
export function damp(
  current: number,
  target: number,
  lambda: number,
  deltaSeconds: number
): number {
  return lerp(current, target, 1 - Math.exp(-lambda * deltaSeconds));
}

/**
 * Default Lenis exponential ease-out curve for programmatic scrollTo calls.
 */
export function defaultEasing(t: number): number {
  return Math.min(1, 1.001 - Math.pow(2, -10 * t));
}
