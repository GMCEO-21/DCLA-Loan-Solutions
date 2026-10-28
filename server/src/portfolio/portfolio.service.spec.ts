import { PortfolioService } from './portfolio.service';

const createQueryBuilder = (rows: unknown[]) => ({
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rows),
});

describe('PortfolioService database aggregation', () => {
  it('returns the established portfolio metrics from one grouped query', async () => {
    const queryBuilder = createQueryBuilder([
      {
        centerId: 'center-1',
        centerName: 'Alpha',
        amountDisbursed: '2800',
        outstandingCollection: '500',
      },
      {
        centerId: 'center-2',
        centerName: 'Beta',
        amountDisbursed: '0',
        outstandingCollection: '0',
      },
    ]);
    const centerRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new PortfolioService(
      centerRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.getPortfolioData();

    expect(centerRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(queryBuilder.getRawMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      totalAmountDisbursed: 2800,
      totalOutstandingCollection: 500,
      centers: [
        {
          no: 1,
          centerName: 'Alpha',
          amountDisbursed: 2800,
          outstandingCollection: 500,
        },
        {
          no: 2,
          centerName: 'Beta',
          amountDisbursed: 0,
          outstandingCollection: 0,
        },
      ],
    });
  });

  it('returns the established projected-income metrics from one grouped query', async () => {
    const queryBuilder = createQueryBuilder([
      {
        centerId: 'center-1',
        centerName: 'Alpha',
        outstandingBalance: '1500',
        interestIncome: '120',
      },
    ]);
    const centerRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new PortfolioService(
      centerRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.getProjectedIncomeData();

    expect(queryBuilder.getRawMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      totalOutstandingBalance: 1500,
      totalInterestIncome: 120,
      centers: [
        {
          no: 1,
          centerName: 'Alpha',
          outstandingBalance: 1500,
          interestIncome: 120,
        },
      ],
    });
  });
});
