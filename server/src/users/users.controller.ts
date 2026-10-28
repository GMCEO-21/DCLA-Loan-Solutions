import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ROLE } from '../auth/roles.constants';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Roles(ROLE.SuperAdmin)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() payload: CreateUserDto) {
    return this.usersService.createUser(payload);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() payload: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, payload);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() payload: UpdateUserStatusDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    if (req.user?.userId && req.user.userId === id && !payload.isActive) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    return this.usersService.updateStatus(id, payload.isActive);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.resetPassword(id);
  }
}
