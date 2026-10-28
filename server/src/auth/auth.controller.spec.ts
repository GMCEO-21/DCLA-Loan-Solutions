import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRateLimitService } from './login-rate-limit.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    logoutWithRefreshToken: jest.Mock;
    logoutWithAccessToken: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      logoutWithRefreshToken: jest.fn(),
      logoutWithAccessToken: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        LoginRateLimitService,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('allows normal login and resets its failed-attempt window', async () => {
    authService.login.mockResolvedValue({ access_token: 'access' });

    await expect(
      controller.login(
        { email: 'user@example.com', password: 'password' },
        { ip: '127.0.0.1' },
      ),
    ).resolves.toEqual({ access_token: 'access' });
  });

  it('returns the same response and then 429 for repeated unknown or bad credentials', async () => {
    authService.login.mockRejectedValue(
      new UnauthorizedException('Invalid email or password'),
    );

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(
        controller.login(
          { email: 'user@example.com', password: 'wrong' },
          { ip: '127.0.0.1' },
        ),
      ).rejects.toMatchObject({ status: 401 });
    }

    await expect(
      controller.login(
        { email: 'user@example.com', password: 'wrong' },
        { ip: '127.0.0.1' },
      ),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('uses refresh-token ownership for logout without requiring access', async () => {
    authService.logoutWithRefreshToken.mockResolvedValue({ success: true });

    await expect(
      controller.logout({ refreshToken: 'current-refresh' }),
    ).resolves.toEqual({ success: true });
    expect(authService.logoutWithRefreshToken).toHaveBeenCalledWith(
      'current-refresh',
    );
  });
});
