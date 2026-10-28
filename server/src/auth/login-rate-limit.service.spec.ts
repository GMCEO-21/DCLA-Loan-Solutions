import { HttpException } from '@nestjs/common';
import { LoginRateLimitService } from './login-rate-limit.service';

describe('LoginRateLimitService', () => {
  it('allows ordinary attempts and returns 429 at the fifth failure', () => {
    const service = new LoginRateLimitService();
    const key = '127.0.0.1:user@example.com';

    for (let attempt = 1; attempt < 5; attempt += 1) {
      service.assertAllowed(key, 1_000);
      service.recordFailure(key, 1_000);
    }

    expect(() => service.recordFailure(key, 1_000)).toThrow(
      expect.objectContaining({ status: 429 }) as HttpException,
    );
    expect(() => service.assertAllowed(key, 1_000)).toThrow(
      expect.objectContaining({ status: 429 }) as HttpException,
    );
  });

  it('resets failures after a successful login and after the window expires', () => {
    const service = new LoginRateLimitService();
    const key = '127.0.0.1:user@example.com';

    service.recordFailure(key, 1_000);
    service.reset(key);
    expect(() => service.assertAllowed(key, 1_000)).not.toThrow();

    service.recordFailure(key, 1_000);
    expect(() =>
      service.assertAllowed(key, 1_000 + LoginRateLimitService.WINDOW_MS),
    ).not.toThrow();
  });
});
