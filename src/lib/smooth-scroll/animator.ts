import { clamp, damp, defaultEasing } from "./math";

export interface AnimateOptions {
  lerp?: number;
  duration?: number;
  easing?: (t: number) => number;
  onStart?: () => void;
  onUpdate?: (value: number, completed: boolean) => void;
}

/**
 * Core scroll animator rewritten from Lenis's Animate class.
 * Supports both frame-rate independent lerp inertia (wheel scrolling)
 * and duration + easing curves (programmatic scrollTo / anchor links).
 */
export class ScrollAnimator {
  isRunning = false;
  value = 0;
  from = 0;
  to = 0;
  currentTime = 0;
  duration = 0;
  lerpFactor?: number;
  easing: (t: number) => number = defaultEasing;
  private onUpdate?: (value: number, completed: boolean) => void;

  advance(deltaSeconds: number): void {
    if (!this.isRunning) return;

    let completed = false;

    if (this.duration && this.easing) {
      this.currentTime += deltaSeconds;
      const linearProgress = clamp(0, this.currentTime / this.duration, 1);
      completed = linearProgress >= 1;
      const easedProgress = completed ? 1 : this.easing(linearProgress);
      this.value = this.from + (this.to - this.from) * easedProgress;
    } else if (this.lerpFactor !== undefined) {
      // Scale lerp factor for frame-rate independent 60fps baseline
      this.value = damp(
        this.value,
        this.to,
        this.lerpFactor * 60,
        deltaSeconds
      );
      if (Math.abs(this.to - this.value) < 0.35) {
        this.value = this.to;
        completed = true;
      }
    } else {
      this.value = this.to;
      completed = true;
    }

    if (completed) {
      this.stop();
    }

    this.onUpdate?.(this.value, completed);
  }

  stop(): void {
    this.isRunning = false;
  }

  fromTo(
    from: number,
    to: number,
    { lerp, duration, easing, onStart, onUpdate }: AnimateOptions
  ): void {
    this.from = this.value = from;
    this.to = to;
    this.lerpFactor = lerp;
    this.duration = duration ?? 0;
    this.easing = easing ?? defaultEasing;
    this.currentTime = 0;
    this.isRunning = true;

    onStart?.();
    this.onUpdate = onUpdate;
  }
}
