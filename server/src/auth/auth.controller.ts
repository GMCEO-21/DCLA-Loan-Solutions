import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LogoutDto } from './dto/logout.dto';
import { AllowTemporaryPassword } from './allow-temporary-password.decorator';
import { LoginRateLimitService } from './login-rate-limit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginRateLimit: LoginRateLimitService,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: { ip?: string; socket?: { remoteAddress?: string } },
  ) {
    const key = this.loginRateLimitKey(req, loginDto.email);
    this.loginRateLimit.assertAllowed(key);

    try {
      const response = await this.authService.login(loginDto);
      this.loginRateLimit.reset(key);
      return response;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.loginRateLimit.recordFailure(key);
      }
      throw error;
    }
  }

  @AllowTemporaryPassword()
  @Get('profile')
  async getProfile(@Req() req: { user: { userId: string } }) {
    return this.authService.getProfile(req.user.userId);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto);
  }

  @Public()
  @Post('logout')
  async logout(
    @Body() body: LogoutDto,
    @Headers('authorization') authorization?: string,
  ) {
    if (body.refreshToken) {
      return this.authService.logoutWithRefreshToken(body.refreshToken);
    }

    const accessToken = this.bearerToken(authorization);
    if (!accessToken) {
      throw new UnauthorizedException('Valid session token required');
    }

    return this.authService.logoutWithAccessToken(accessToken);
  }

  @AllowTemporaryPassword()
  @Put('change-password')
  async changePassword(
    @Req() req: { user: { userId: string } },
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, body);
  }

  private loginRateLimitKey(
    req: { ip?: string; socket?: { remoteAddress?: string } },
    email: string,
  ): string {
    const address = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return `${address}:${email.trim().toLowerCase()}`;
  }

  private bearerToken(authorization?: string): string | null {
    const [scheme, token] = authorization?.trim().split(/\s+/, 2) ?? [];
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }
}
