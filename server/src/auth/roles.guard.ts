import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { ROLE } from './roles.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const userRole = request.user?.role;

    if (typeof userRole !== 'string') {
      return false;
    }

    // Operational admins can perform every business workflow, but never access
    // endpoints explicitly reserved for superadmin account administration.
    if (userRole === ROLE.Admin) {
      return !requiredRoles.includes(ROLE.SuperAdmin);
    }

    return requiredRoles.includes(userRole);
  }
}
