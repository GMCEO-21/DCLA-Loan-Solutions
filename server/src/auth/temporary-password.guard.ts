import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_TEMPORARY_PASSWORD_KEY } from './allow-temporary-password.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class TemporaryPasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    const isAllowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_TEMPORARY_PASSWORD_KEY,
      targets,
    );

    if (isPublic || isAllowed) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { mustChangePassword?: boolean };
    }>();

    if (request.user?.mustChangePassword) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password change is required before accessing this resource.',
      });
    }

    return true;
  }
}
