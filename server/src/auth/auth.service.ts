import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { User } from '../users/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private sanitizeUser(user: User) {
    const { password, hashedRefreshToken, ...safeUser } = user;
    void password;
    void hashedRefreshToken;
    return {
      ...safeUser,
      role: user.role.name,
    };
  }

  private buildPayload(user: User) {
    return { email: user.email, sub: user.id, role: user.role.name };
  }

  private async signTokens(user: User) {
    const payload = this.buildPayload(user);
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, type: 'refresh' },
      {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ??
          this.configService.get<string>('JWT_SECRET'),
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      },
    );

    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshTokenHash(userId, hashedRefreshToken);
  }

  private async buildAuthResponse(user: User) {
    const { accessToken, refreshToken } = await this.signTokens(user);
    await this.persistRefreshToken(user.id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    try {
      this.logger.debug(`Attempting to validate user with email: ${email}`);
      const user = await this.usersService.findByEmail(email);

      if (!user || !user.isActive) {
        this.logger.warn(
          `Validation failed: user with email ${email} not found`,
        );
        return null;
      }

      const passwordMatch = await bcrypt.compare(pass, user.password);
      if (passwordMatch) {
        return user;
      }
      this.logger.warn(`Validation failed: password mismatch for ${email}`);
      return null;
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error validating user ${email}`, stack);
      throw new InternalServerErrorException('User validation failed');
    }
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`Login successful for user ${user.email}`);
    return this.buildAuthResponse(user);
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or missing');
    }

    return this.sanitizeUser(user);
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const user = await this.validateRefreshToken(refreshTokenDto.refreshToken);
    return this.buildAuthResponse(user);
  }

  async logoutWithRefreshToken(refreshToken: string) {
    const user = await this.validateRefreshToken(refreshToken);
    await this.usersService.updateRefreshTokenHash(user.id, null);
    return { success: true };
  }

  async logoutWithAccessToken(accessToken: string) {
    let payload: { sub?: string; type?: string };

    try {
      payload = await this.jwtService.verifyAsync(accessToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (!payload.sub || payload.type === 'refresh') {
      throw new UnauthorizedException('Invalid access token');
    }

    await this.usersService.updateRefreshTokenHash(payload.sub, null);
    return { success: true };
  }

  private async validateRefreshToken(refreshToken: string): Promise<User> {
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_SECRET');

    let payload: { sub: string; type?: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or missing');
    }

    const passwordMatch = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    const updatedUser = await this.usersService.changePassword(
      userId,
      hashedPassword,
    );

    return {
      message: 'Password changed successfully',
      user: updatedUser,
    };
  }
}
