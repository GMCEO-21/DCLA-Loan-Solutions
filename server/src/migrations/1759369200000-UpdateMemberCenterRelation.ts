import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class UpdateMemberCenterRelation1759369200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('member');
    if (!table) {
      return;
    }

    const existingFk = table.foreignKeys.find((fk) =>
      fk.columnNames.includes('centerId'),
    );
    if (existingFk) {
      await queryRunner.dropForeignKey('member', existingFk);
    }

    const centerIdColumn = table.findColumnByName('centerId');
    if (centerIdColumn) {
      if (!centerIdColumn.isNullable) {
        await queryRunner.changeColumn(
          'member',
          'centerId',
          new TableColumn({
            ...centerIdColumn,
            isNullable: true,
          }),
        );
      }
    } else {
      await queryRunner.addColumn(
        'member',
        new TableColumn({
          name: 'centerId',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    const refreshedTable = await queryRunner.getTable('member');
    const newFk = refreshedTable?.foreignKeys.find((fk) =>
      fk.columnNames.includes('centerId'),
    );
    if (!newFk) {
      await queryRunner.createForeignKey(
        'member',
        new TableForeignKey({
          columnNames: ['centerId'],
          referencedTableName: 'center',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('member');
    if (!table) {
      return;
    }

    const existingFk = table.foreignKeys.find((fk) =>
      fk.columnNames.includes('centerId'),
    );
    if (existingFk) {
      await queryRunner.dropForeignKey('member', existingFk);
    }

    const refreshedTable = await queryRunner.getTable('member');
    const newFk = refreshedTable?.foreignKeys.find((fk) =>
      fk.columnNames.includes('centerId'),
    );
    if (!newFk) {
      await queryRunner.createForeignKey(
        'member',
        new TableForeignKey({
          columnNames: ['centerId'],
          referencedTableName: 'center',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
        }),
      );
    }
  }
}
