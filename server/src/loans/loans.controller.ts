import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { ReloanDto } from './dto/reloan.dto';
import { UpdateLoanTermDto } from './dto/update-loan-term.dto';
import { ApplyLoanWaiverDto } from './dto/apply-loan-waiver.dto';
import { FindMemberLoansQueryDto } from './dto/find-member-loans-query.dto';
import { ROLE } from '../auth/roles.constants';
import { Roles } from '../auth/roles.decorator';
import { LoanChargesService } from './loan-charges.service';
import { LoanChargeSweepService } from './loan-charge-sweep.service';

@Controller('loans')
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly loanChargesService: LoanChargesService,
    private readonly loanChargeSweepService: LoanChargeSweepService,
  ) {}

  @Roles(ROLE.LoanProcessor)
  @Post()
  create(
    @Body() createLoanDto: CreateLoanDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.loansService.create(createLoanDto, req.user?.userId);
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get()
  findAll() {
    return this.loansService.findAll();
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get('member/:id')
  findByMember(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: FindMemberLoansQueryDto,
  ) {
    return this.loansService.findByMember(id, query);
  }

  @Roles(ROLE.Manager)
  @Get('waivers/candidates')
  getWaiverCandidates() {
    return this.loansService.getWaiverCandidates();
  }

  @Roles(ROLE.Manager)
  @Post('charges/sweep')
  runChargeSweep(@Req() req: { user?: { userId?: string } }) {
    return this.loanChargeSweepService.run(
      undefined,
      'manual',
      req.user?.userId,
    );
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get(':id/charges')
  getCharges(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loanChargesService.getBreakdown(id);
  }

  @Roles(ROLE.Manager)
  @Get(':id/waivers')
  getWaiversByLoan(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.getWaiversByLoan(id);
  }

  @Roles(ROLE.Manager)
  @Post(':id/waivers')
  applyWaiver(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApplyLoanWaiverDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.loansService.applyWaiver(id, body, req.user?.userId);
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.findOne(id);
  }

  // Eligibility by loan id (not just by member)
  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get(':id/eligibility')
  eligibilityByLoan(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.eligibilityByLoan(id);
  }

  // Create a reloan for an existing loan (net off or pay off)
  @Roles(ROLE.LoanProcessor)
  @Post(':id/reloan')
  reloan(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReloanDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.loansService.reloan(id, body, req.user?.userId);
  }

  @Roles(ROLE.LoanProcessor)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateLoanDto: UpdateLoanDto,
  ) {
    return this.loansService.update(id, updateLoanDto);
  }

  @Roles(ROLE.LoanProcessor)
  @Patch(':id/term')
  updateTerm(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateLoanTermDto,
  ) {
    return this.loansService.updateTermWeeks(
      id,
      body.termWeeks,
      body.monthlyInterestRate,
    );
  }

  @Roles(ROLE.LoanProcessor)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.remove(id);
  }

  @Roles(ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor)
  @Get('member/:id/eligibility')
  checkEligibility(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.loansService.isEligibleForReloan(id);
  }
}
