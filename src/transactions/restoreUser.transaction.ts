import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { User } from 'src/entities';
import { UserService } from 'src/services';
import { DataSource, EntityManager } from 'typeorm';
import { BaseTransaction } from './base.transaction';

@Injectable()
export class RestoreUserTransaction extends BaseTransaction {
  constructor(
    dataSource: DataSource,
    @Inject(process.env.BANK_RABBITMQ_SERVICE)
    private readonly bankClientProxy: ClientProxy,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {
    super(dataSource);
  }

  protected async execute(
    manager: EntityManager,
    id: number,
    parentId: number,
    user: User,
  ): Promise<User> {
    const restoredUser = await this.userService.restoreOneWithEntityManager(
      manager,
      id,
      parentId,
    );
    await this.bankClientProxy
      .send('restored_user', { payload: restoredUser, user })
      .toPromise();
    return restoredUser;
  }
}
