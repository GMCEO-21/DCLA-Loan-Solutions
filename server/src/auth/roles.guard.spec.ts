import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE } from './roles.constants';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  const contextFor = (role?: string) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('allows a role explicitly assigned to an endpoint', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([ROLE.Cashier]);

    expect(guard.canActivate(contextFor(ROLE.Cashier))).toBe(true);
  });

  it('allows an operational admin on business endpoints', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([ROLE.Manager]);

    expect(guard.canActivate(contextFor(ROLE.Admin))).toBe(true);
  });

  it('keeps user-management endpoints exclusive to superadmin', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([ROLE.SuperAdmin]);

    expect(guard.canActivate(contextFor(ROLE.Admin))).toBe(false);
    expect(guard.canActivate(contextFor(ROLE.SuperAdmin))).toBe(true);
  });
});
