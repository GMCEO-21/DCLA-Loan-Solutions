import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { createMigrationDatabaseOptions } from './config/database.config';

dotenv.config();

export const AppDataSource = new DataSource(
  createMigrationDatabaseOptions(process.env),
);
