import {
  Controller,
  ExecutionContext,
  INestApplication,
  Put,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { MembersController } from '../members/members.controller';
import { MembersService } from '../members/members.service';
import { AllowTemporaryPassword } from './allow-temporary-password.decorator';
import { TemporaryPasswordGuard } from './temporary-password.guard';

@Controller('temporary-password-test')
class TemporaryPasswordTestController {
  @AllowTemporaryPassword()
  @Put('change-password')
  changePassword() {
    return { changed: true };
  }
}

describe('TemporaryPasswordGuard', () => {
  let app: INestApplication;
  let httpServer: App;
  let mustChangePassword = true;

  beforeEach(async () => {
    mustChangePassword = true;
    const module = await Test.createTestingModule({
      controllers: [TemporaryPasswordTestController, MembersController],
      providers: [
        {
          provide: MembersService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalGuards(
      {
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            user?: { role: string; mustChangePassword: boolean };
          }>();
          req.user = {
            role: 'admin',
            mustChangePassword,
          };
          return true;
        },
      },
      new TemporaryPasswordGuard(app.get(Reflector)),
    );
    await app.init();
    httpServer = app.getHttpServer() as App;
  });

  afterEach(async () => app.close());

  it('rejects ordinary APIs with a distinguishable password-change error', async () => {
    const response = await request(httpServer).get('/members').expect(403);

    expect(response.body).toMatchObject({
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  });

  it('allows password change and restores normal API access afterward', async () => {
    await request(httpServer)
      .put('/temporary-password-test/change-password')
      .expect(200, { changed: true });

    mustChangePassword = false;
    await request(httpServer)
      .get('/members')
      .expect(200, { items: [], total: 0 });
  });

  it.each(['admin', 'superadmin'])(
    'does not alter normal %s access',
    (role) => {
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
      const guard = new TemporaryPasswordGuard(
        reflector as unknown as Reflector,
      );
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user: { role, mustChangePassword: false } }),
        }),
      };

      expect(guard.canActivate(context as never)).toBe(true);
    },
  );
});
