import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CentersService } from './centers.service';
import { CreateCenterDto } from './dto/create-center.dto';
import { UpdateCenterDto } from './dto/update-center.dto';
import { FindCentersQueryDto } from './dto/find-centers-query.dto';
import { ROLE } from '../auth/roles.constants';
import { Roles } from '../auth/roles.decorator';

@Controller('centers')
export class CentersController {
  constructor(private readonly centersService: CentersService) {}

  @Roles(ROLE.LoanProcessor)
  @Post()
  create(@Body() createCenterDto: CreateCenterDto) {
    return this.centersService.create(createCenterDto);
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get()
  findAll(@Query() query: FindCentersQueryDto) {
    return this.centersService.findAll(query);
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get('options')
  findOptions() {
    return this.centersService.findOptions();
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.centersService.findOne(id);
  }

  @Roles(ROLE.LoanProcessor)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateCenterDto: UpdateCenterDto,
  ) {
    return this.centersService.update(id, updateCenterDto);
  }

  @Roles(ROLE.LoanProcessor)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.centersService.remove(id);
  }
}
