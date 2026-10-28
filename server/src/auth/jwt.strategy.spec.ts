import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ROLE } from './roles.constants';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

describe('JwtStrategy', () => {
  it('loads current user state including mustChangePassword', async () => {
    const usersService = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        isActive: true,
        mustChangePassword: true,
        role: { name: ROLE.LoanProcessor },
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('jwt-secret') },
        },
      ],
    }).compile();

    const strategy = module.get(JwtStrategy);
    await expect(strategy.validate({ sub: 'user-id' })).resolves.toEqual({
      userId: 'user-id',
      email: 'user@example.com',
      role: ROLE.LoanProcessor,
      mustChangePassword: true,
    });
  });
});
