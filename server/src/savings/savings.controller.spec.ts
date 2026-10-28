/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { SavingsHistoryService } from './savings-history.service';
import { SavingsHistoryScope } from './dto/savings-history-query.dto';
import { ROLES_KEY } from '../auth/roles.decorator';
import { ROLE } from '../auth/roles.constants';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';

describe('SavingsController', () => {
  let controller: SavingsController;
  let service: {
    deposit: jest.Mock;
    withdraw: jest.Mock;
    findByMember: jest.Mock;
  };
  let historyService: { findMemberHistory: jest.Mock };

  beforeEach(async () => {
    service = {
      deposit: jest.fn(),
      withdraw: jest.fn(),
      findByMember: jest.fn(),
    };
    historyService = { findMemberHistory: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingsController],
      providers: [
        {
          provide: SavingsService,
          useValue: service,
        },
        {
          provide: SavingsHistoryService,
          useValue: historyService,
        },
      ],
    }).compile();

    controller = module.get<SavingsController>(SavingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it.each(['deposit', 'withdraw'] as const)(
    'uses the authenticated actor for %s and does not accept a body override',
    async (operation) => {
      const dto = {
        memberId: 'member-1',
        loanId: 'loan-1',
        amount: 100,
        performedById: 'spoofed-actor',
      };
      service[operation].mockResolvedValue({ ok: true });

      await controller[operation](dto, {
        user: { userId: 'authenticated-actor' },
      });

      expect(service[operation]).toHaveBeenCalledWith(
        dto,
        'authenticated-actor',
      );
    },
  );

  it('delegates member history with the validated query', async () => {
    const query = { scope: SavingsHistoryScope.LEDGER, page: 1, limit: 25 };
    historyService.findMemberHistory.mockResolvedValue({ items: [] });

    await controller.getMemberSavingsHistory('member-1', query);

    expect(historyService.findMemberHistory).toHaveBeenCalledWith(
      'member-1',
      query,
    );
  });

  it('uses the existing protected savings-read roles for history', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      SavingsController.prototype.getMemberSavingsHistory,
    ) as string[];

    expect(roles).toEqual([ROLE.Manager, ROLE.Cashier, ROLE.LoanProcessor]);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        SavingsController.prototype.getMemberSavingsHistory,
      ),
    ).not.toBe(true);
  });

  it.each(['deposit', 'withdraw'] as const)(
    'keeps %s restricted to the existing Cashier role',
    (operation) => {
      expect(
        Reflect.getMetadata(ROLES_KEY, SavingsController.prototype[operation]),
      ).toEqual([ROLE.Cashier]);
    },
  );
});
