import { Controller, Get, Query } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { ROLE } from '../auth/roles.constants';
import { Roles } from '../auth/roles.decorator';

@Roles(ROLE.Manager)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  private parseOptionalNumber(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  @Get()
  async getPortfolioData() {
    return this.portfolioService.getPortfolioData();
  }

  @Get('projected-income')
  async getProjectedIncomeData() {
    return this.portfolioService.getProjectedIncomeData();
  }

  @Get('expected-revenue')
  async getExpectedRevenueData(
    @Query('granularity') granularity?: 'weekly' | 'monthly',
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.portfolioService.getExpectedRevenueData(granularity, {
      month: this.parseOptionalNumber(month),
      year: this.parseOptionalNumber(year),
    });
  }

  @Get('actual-revenue')
  async getRealizedRevenueData(
    @Query('granularity') granularity?: 'weekly' | 'monthly',
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.portfolioService.getRealizedRevenueData(granularity, {
      month: this.parseOptionalNumber(month),
      year: this.parseOptionalNumber(year),
    });
  }
}
