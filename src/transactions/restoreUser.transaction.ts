import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { User } from 'src/entities';
import { UserService } from 'src/services';
import { RestoreUserTransactionInput } from 'src/types';
import { DataSource, EntityManager } from 'typeorm';
import { BaseTransaction } from './base.transaction';

@Injectable()
export class RestoreUserTransaction extends BaseTransaction<
  RestoreUserTransactionInput,
  User
> {
  constructor(
    dataSource: DataSource,
    @Inject(process.env.USER_RABBITMQ_SERVICE)
    private readonly clientProxy: ClientProxy,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {
    super(dataSource);
  }

  protected async execute(
    data: RestoreUserTransactionInput,
    manager: EntityManager,
  ): Promise<User> {
    const restoredUser = await this.userService.restoreOneWithEntityManager(
      data.id,
      data.user,
      manager,
    );
    await this.clientProxy
      .send('restored_user', { currentUser: data.user, restoredUser })
      .toPromise();
    return restoredUser;
  }
}
