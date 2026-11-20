import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

interface AttemptState {
  count: number;
  lockedUntil: number;
}

@Injectable()
export class LoginAttemptTracker {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly inflight = new Map<string, number>();
  private readonly maxEntries = 5000;

  beginAttempt(email: string): void {
    const now = Date.now();
    const state = this.attempts.get(email);
    if (state && state.lockedUntil > now) {
      throw new HttpException(
        'Demasiados intentos. Espera unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (state && state.lockedUntil > 0 && state.lockedUntil <= now) {
      this.attempts.delete(email);
    }

    const current = this.attempts.get(email);
    const pending = this.inflight.get(email) ?? 0;
    if ((current?.count ?? 0) + pending >= MAX_FAILURES) {
      throw new HttpException(
        'Demasiados intentos. Espera unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.inflight.set(email, pending + 1);
  }

  completeAttempt(email: string, success: boolean): void {
    this.releaseInflight(email);
    if (success) {
      this.attempts.delete(email);
      return;
    }
    this.recordFailure(email);
  }

  cancelAttempt(email: string): void {
    this.releaseInflight(email);
  }

  private releaseInflight(email: string): void {
    const pending = this.inflight.get(email) ?? 0;
    if (pending <= 1) {
      this.inflight.delete(email);
      return;
    }
    this.inflight.set(email, pending - 1);
  }

  private recordFailure(email: string): void {
    const now = Date.now();
    const state = this.attempts.get(email);
    const next: AttemptState = !state || (state.lockedUntil > 0 && state.lockedUntil <= now)
      ? { count: 1, lockedUntil: 0 }
      : {
          count: state.count + 1,
          lockedUntil: state.count + 1 >= MAX_FAILURES ? now + LOCK_MS : 0,
        };
    if (next.lockedUntil > 0) {
      next.count = 0;
    }
    this.remember(email, next);
  }

  private remember(email: string, state: AttemptState): void {
    if (this.attempts.has(email)) {
      this.attempts.delete(email);
    }
    this.attempts.set(email, state);
    if (this.attempts.size <= this.maxEntries) {
      return;
    }
    const now = Date.now();
    for (const [key, value] of this.attempts) {
      if (this.attempts.size <= this.maxEntries) {
        return;
      }
      if (key !== email && value.lockedUntil <= now) {
        this.attempts.delete(key);
      }
    }
    for (const key of this.attempts.keys()) {
      if (this.attempts.size <= this.maxEntries || key === email) {
        continue;
      }
      this.attempts.delete(key);
    }
  }
}
