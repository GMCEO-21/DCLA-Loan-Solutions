import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type FailureWindow = {
  count: number;
  resetAt: number;
};

@Injectable()
export class LoginRateLimitService {
  static readonly MAX_FAILURES = 5;
  static readonly WINDOW_MS = 15 * 60 * 1000;

  private readonly failures = new Map<string, FailureWindow>();

  assertAllowed(key: string, now = Date.now()): void {
    const entry = this.getActiveEntry(key, now);
    if (entry && entry.count >= LoginRateLimitService.MAX_FAILURES) {
      this.throwRateLimit();
    }
  }

  recordFailure(key: string, now = Date.now()): void {
    const current = this.getActiveEntry(key, now);
    const next: FailureWindow = current
      ? { ...current, count: current.count + 1 }
      : { count: 1, resetAt: now + LoginRateLimitService.WINDOW_MS };

    this.failures.set(key, next);
    if (next.count >= LoginRateLimitService.MAX_FAILURES) {
      this.throwRateLimit();
    }
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private getActiveEntry(key: string, now: number): FailureWindow | undefined {
    const entry = this.failures.get(key);
    if (entry && entry.resetAt <= now) {
      this.failures.delete(key);
      return undefined;
    }
    return entry;
  }

  private throwRateLimit(): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        code: 'LOGIN_RATE_LIMITED',
        message: 'Too many login attempts. Please try again later.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
