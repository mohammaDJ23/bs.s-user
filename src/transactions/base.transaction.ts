import { DataSource, EntityManager } from 'typeorm';

export abstract class BaseTransaction<
  TransactionInput = any,
  TransactionOutput = any,
> {
  constructor(private readonly dataSource: DataSource) {}

  protected abstract execute(
    data: TransactionInput,
    manager: EntityManager,
  ): Promise<TransactionOutput>;

  async run(data: TransactionInput): Promise<TransactionOutput> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const result = await this.execute(data, queryRunner.manager);
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
