import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RepaymentsService } from '../repayments/repayments.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const repaymentsService = app.get(RepaymentsService);
    const summary = await repaymentsService.repairExistingRepaymentSchedules(
      (message) => console.log(message),
    );

    console.log('Repayment schedule repair completed.');
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error('Repayment schedule repair failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
