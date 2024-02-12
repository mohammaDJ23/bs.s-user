import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { UserService } from 'src/services';
import { DataSource, EntityManager } from 'typeorm';
import { BaseTransaction } from './base.transaction';
import { ClientProxy } from '@nestjs/microservices';
import { User } from 'src/entities';

@Injectable()
export class DeleteUserTransaction extends BaseTransaction {
  constructor(
    dataSource: DataSource,
    @Inject(process.env.BANK_RABBITMQ_SERVICE)
    private readonly bankClientProxy: ClientProxy,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {
    super(dataSource);
  }

  protected async execute(manager: EntityManager, user: User): Promise<User> {
    const deletedUser = await this.userService.deleteWithEntityManager(
      manager,
      user,
    );
    await this.bankClientProxy
      .send('deleted_user', { payload: deletedUser, user })
      .toPromise();
    return;
  }
}
