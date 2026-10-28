import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Role } from '../roles/role.entity';
import { ROLE, type RoleName } from '../auth/roles.constants';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

type SafeUser = Omit<User, 'password' | 'hashedRefreshToken' | 'role'> & {
  role: string;
};

const ASSIGNABLE_ROLES: RoleName[] = [
  ROLE.Admin,
  ROLE.LoanProcessor,
  ROLE.Cashier,
  ROLE.Manager,
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async updateRefreshTokenHash(
    id: string,
    hashedRefreshToken: string | null,
  ): Promise<void> {
    await this.userRepo.update(id, { hashedRefreshToken });
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.userRepo.find({
      order: { createdAt: 'DESC' },
    });
    return users.map((user) => this.sanitizeUser(user));
  }

  async createUser(
    payload: CreateUserDto,
  ): Promise<{ user: SafeUser; tempPassword: string }> {
    const existing = await this.findByEmail(payload.email);
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    const role = await this.resolveRole(payload.role);
    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = this.userRepo.create({
      email: payload.email,
      firstName: payload.firstName,
      middleName: payload.middleName ?? null,
      lastName: payload.lastName,
      password: hashedPassword,
      role,
      isActive: true,
      mustChangePassword: true,
    });

    const saved = await this.userRepo.save(user);
    return { user: this.sanitizeUser(saved), tempPassword };
  }

  async updateUser(id: string, payload: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (payload.email && payload.email !== user.email) {
      const existing = await this.findByEmail(payload.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email is already in use');
      }
      user.email = payload.email;
    }

    if (payload.firstName !== undefined) user.firstName = payload.firstName;
    if (payload.middleName !== undefined) user.middleName = payload.middleName;
    if (payload.lastName !== undefined) user.lastName = payload.lastName;

    if (payload.role) {
      if (
        user.role?.name === ROLE.SuperAdmin &&
        payload.role !== ROLE.SuperAdmin
      ) {
        throw new BadRequestException('Cannot change the superadmin role');
      }
      user.role = await this.resolveRole(payload.role);
    }

    const saved = await this.userRepo.save(user);
    return this.sanitizeUser(saved);
  }

  async updateStatus(id: string, isActive: boolean) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role?.name === ROLE.SuperAdmin && !isActive) {
      throw new BadRequestException('Cannot deactivate the superadmin account');
    }

    user.isActive = isActive;
    if (!isActive) {
      user.hashedRefreshToken = null;
    }
    const saved = await this.userRepo.save(user);
    return this.sanitizeUser(saved);
  }

  async resetPassword(id: string): Promise<{ tempPassword: string }> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tempPassword = this.generateTempPassword();
    user.password = await bcrypt.hash(tempPassword, 10);
    user.mustChangePassword = true;
    user.hashedRefreshToken = null;
    await this.userRepo.save(user);

    return { tempPassword };
  }

  async changePassword(
    id: string,
    hashedPassword: string,
  ): Promise<SafeUser> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.password = hashedPassword;
    user.mustChangePassword = false;
    const saved = await this.userRepo.save(user);
    return this.sanitizeUser(saved);
  }
  private async resolveRole(roleName: RoleName) {
    if (!ASSIGNABLE_ROLES.includes(roleName)) {
      throw new BadRequestException('Invalid role assignment');
    }

    const role = await this.roleRepo.findOne({ where: { name: roleName } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const length = 12;
    let password = '';
    for (let i = 0; i < length; i += 1) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
  }

  private sanitizeUser(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, hashedRefreshToken, role, ...safeUser } = user;
    return {
      ...safeUser,
      role: role?.name ?? '',
    };
  }
}
