import { DataSource, EntityManager } from 'typeorm';

export abstract class BaseTransaction {
  constructor(private readonly dataSource: DataSource) {}

  protected abstract execute(
    manager: EntityManager,
    ...args: any[]
  ): Promise<any>;

  async run(...args: any[]): Promise<any> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const result = await this.execute(queryRunner.manager, ...args);
        await queryRunner.commitTransaction();
        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      throw error;
    }
  }
}
