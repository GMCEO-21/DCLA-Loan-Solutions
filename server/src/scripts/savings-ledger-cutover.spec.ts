import { DataSource, Repository } from 'typeorm';
import { LoansService } from '../loans/loans.service';
import { Member } from '../members/entities/member.entity';
import {
  SAVINGS_OPENING_CONFIRMATION,
  SavingsLedgerCutoverResult,
  SavingsLedgerCutoverService,
} from '../savings/savings-ledger-cutover.service';
import { Savings } from '../savings/savings.entity';
import {
  executeSavingsLedgerCutoverCommand,
  parseSavingsLedgerCutoverArgs,
} from './savings-ledger-cutover';

describe('savings ledger cutover command', () => {
  it('defaults to dry-run and delegates without apply permission', async () => {
    const result = { mode: 'dry-run' } as SavingsLedgerCutoverResult;
    const run = jest.fn().mockResolvedValue(result);
    const service = {
      run,
    } as unknown as SavingsLedgerCutoverService;

    await expect(executeSavingsLedgerCutoverCommand(service, [])).resolves.toBe(
      result,
    );
    expect(run).toHaveBeenCalledWith({ apply: false, at: undefined });
  });

  it('accepts an explicit dry-run flag', () => {
    expect(parseSavingsLedgerCutoverArgs(['--dry-run'])).toEqual({
      apply: false,
    });
  });

  it('refuses apply without the deterministic confirmation', () => {
    expect(() => parseSavingsLedgerCutoverArgs(['--apply'])).toThrow(
      `Apply requires --confirm=${SAVINGS_OPENING_CONFIRMATION}`,
    );
    expect(() =>
      parseSavingsLedgerCutoverArgs([
        '--apply',
        '--confirm=incorrect-confirmation',
      ]),
    ).toThrow(`Apply requires --confirm=${SAVINGS_OPENING_CONFIRMATION}`);
  });

  it('enables apply only with both explicit arguments', () => {
    expect(
      parseSavingsLedgerCutoverArgs([
        '--apply',
        `--confirm=${SAVINGS_OPENING_CONFIRMATION}`,
      ]),
    ).toEqual({ apply: true });
  });

  it('keeps service dry-run free of member transactions', async () => {
    const transaction = jest.fn();
    const dataSource = { transaction } as unknown as DataSource;
    const memberRepository = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<Member>;
    const service = new SavingsLedgerCutoverService(
      dataSource,
      memberRepository,
      {} as Repository<Savings>,
      {} as LoansService,
    );

    const result = await service.run({
      at: new Date('2026-09-03T16:30:00.000Z'),
    });

    expect(result.mode).toBe('dry-run');
    expect(result.businessDate).toBe('2026-09-04');
    expect(result.preflight.summary.membersScanned).toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });
});
