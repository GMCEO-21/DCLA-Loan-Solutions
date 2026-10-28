import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { ROLE } from './roles.constants';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import type { User } from '../users/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    updateRefreshTokenHash: jest.Mock;
    changePassword: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let user: User;

  beforeEach(async () => {
    user = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'manager@example.com',
      password: 'password-hash',
      firstName: 'Test',
      middleName: null,
      lastName: 'Manager',
      role: { name: ROLE.Manager } as User['role'],
      isActive: true,
      mustChangePassword: false,
      hashedRefreshToken: 'refresh-hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    usersService = {
      findByEmail: jest.fn().mockResolvedValue(user),
      findById: jest.fn().mockImplementation(() => user),
      updateRefreshTokenHash: jest
        .fn()
        .mockImplementation((_id: string, hash: string | null) => {
          user.hashedRefreshToken = hash;
        }),
      changePassword: jest.fn().mockImplementation(() => ({
        ...user,
        mustChangePassword: false,
        role: ROLE.Manager,
      })),
    };
    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
      verifyAsync: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                JWT_SECRET: 'access-secret',
                JWT_REFRESH_SECRET: 'refresh-secret',
                JWT_REFRESH_EXPIRES_IN: '7d',
              })[key],
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash' as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('logs in a normal active user and persists the issued refresh token', async () => {
    const response = await service.login({
      email: user.email,
      password: 'valid-password',
    });

    expect(response).toMatchObject({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: { id: user.id, role: ROLE.Manager },
    });
    expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
      user.id,
      'new-hash',
    );
  });

  it('does not disclose whether an email exists', async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);
    const unknownAccount = await service
      .login({ email: 'unknown@example.com', password: 'wrong-password' })
      .catch((error: unknown) => error);

    usersService.findByEmail.mockResolvedValueOnce(user);
    jest.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
    const wrongPassword = await service
      .login({ email: user.email, password: 'wrong-password' })
      .catch((error: unknown) => error);

    expect(unknownAccount).toBeInstanceOf(UnauthorizedException);
    expect(wrongPassword).toBeInstanceOf(UnauthorizedException);
    expect((unknownAccount as UnauthorizedException).getResponse()).toEqual(
      (wrongPassword as UnauthorizedException).getResponse(),
    );
  });

  it('rotates a valid current refresh token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      type: 'refresh',
    });

    const response = await service.refreshTokens({ refreshToken: 'current' });

    expect(response.refresh_token).toBe('refresh-token');
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('current', {
      secret: 'refresh-secret',
    });
  });

  it('revokes with a valid refresh token when access is expired', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      type: 'refresh',
    });

    await expect(service.logoutWithRefreshToken('current')).resolves.toEqual({
      success: true,
    });
    expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
      user.id,
      null,
    );
    await expect(
      service.refreshTokens({ refreshToken: 'current' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('retains valid-access-token logout compatibility', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: user.id });

    await expect(
      service.logoutWithAccessToken('access-token'),
    ).resolves.toEqual({ success: true });
    expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
      user.id,
      null,
    );
  });

  it('clears mustChangePassword through the existing password-change service', async () => {
    user.mustChangePassword = true;

    const response = await service.changePassword(user.id, {
      currentPassword: 'temporary-password',
      newPassword: 'new-password',
    });

    expect(usersService.changePassword).toHaveBeenCalledWith(
      user.id,
      'new-hash',
    );
    expect(response.user.mustChangePassword).toBe(false);
  });
});
