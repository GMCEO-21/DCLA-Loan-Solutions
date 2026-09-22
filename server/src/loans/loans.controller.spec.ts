import { Test, TestingModule } from '@nestjs/testing';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { ReloanDto } from './dto/reloan.dto';
import { LoanChargesService } from './loan-charges.service';
import { LoanChargeSweepService } from './loan-charge-sweep.service';

describe('LoansController', () => {
  let controller: LoansController;
  let service: { create: jest.Mock; reloan: jest.Mock };

  beforeEach(async () => {
    service = { create: jest.fn(), reloan: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoansController],
      providers: [
        { provide: LoansService, useValue: service },
        { provide: LoanChargesService, useValue: {} },
        { provide: LoanChargeSweepService, useValue: {} },
      ],
    }).compile();

    controller = module.get<LoansController>(LoansController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('propagates the authenticated loan-creation actor separately from the DTO', async () => {
    const dto = { borrowerId: 'member-1' } as CreateLoanDto;
    service.create.mockResolvedValue({ id: 'loan-1' });

    await controller.create(dto, { user: { userId: 'loan-processor-1' } });

    expect(service.create).toHaveBeenCalledWith(dto, 'loan-processor-1');
  });

  it('propagates the authenticated reloan actor separately from the DTO', async () => {
    const dto = { newPrincipalAmount: 10_000 } as ReloanDto;
    service.reloan.mockResolvedValue({ newLoanId: 'loan-2' });

    await controller.reloan('loan-1', dto, {
      user: { userId: 'loan-processor-1' },
    });

    expect(service.reloan).toHaveBeenCalledWith(
      'loan-1',
      dto,
      'loan-processor-1',
    );
  });
});
