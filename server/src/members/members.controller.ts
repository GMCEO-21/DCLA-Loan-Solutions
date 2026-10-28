import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { FindMembersQueryDto } from './dto/find-members-query.dto';
import { FindCenterMembersQueryDto } from './dto/find-center-members-query.dto';
import { ROLE } from '../auth/roles.constants';
import { Roles } from '../auth/roles.decorator';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Roles(ROLE.LoanProcessor)
  @Post()
  create(@Body() createMemberDto: CreateMemberDto) {
    return this.membersService.create(createMemberDto);
  }

  @Roles(ROLE.Manager, ROLE.LoanProcessor)
  @Get()
  findAll(@Query() query: FindMembersQueryDto) {
    return this.membersService.findAll(query);
  }

  @Roles(ROLE.Manager, ROLE.LoanProcessor)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.membersService.findOne(id); // removed +id
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get('center/:centerId')
  getCenterMembers(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Query() query: FindCenterMembersQueryDto,
  ) {
    return this.membersService.getCenterMembers(centerId, query.date);
  }

  @Roles(ROLE.LoanProcessor)
  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return this.membersService.update(id, updateMemberDto); // removed +id
  }

  @Roles(ROLE.LoanProcessor)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.membersService.remove(id); // removed +id
  }
}
