import { UpdateResult } from 'typeorm';

interface CustomQueryBuilder<Entity> {
  exe<E extends Entity = Entity>(
    this: QueryBuilder<Entity>,
    options?: ExeOptions,
  ): Promise<E>;
}

interface ExeOptions {
  camelcase?: boolean;
  noEffectError?: string;
  resultType?: 'object' | 'array';
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity> extends CustomQueryBuilder<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity> extends CustomQueryBuilder<Entity> {}
}
