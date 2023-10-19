import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { UserService } from 'src/services';
import { UpdateUserObj } from 'src/types';
import { DataSource, EntityManager } from 'typeorm';
import { BaseTransaction } from './base.transaction';
import { ClientProxy } from '@nestjs/microservices';
import { User } from 'src/entities';

@Injectable()
export class UpdateUserTransaction extends BaseTransaction<
  UpdateUserObj,
  User
> {
  constructor(
    dataSource: DataSource,
    @Inject(process.env.BANK_RABBITMQ_SERVICE)
    private readonly bankClientProxy: ClientProxy,
    @Inject(process.env.NOTIFICATION_RABBITMQ_SERVICE)
    private readonly notificationClientProxy: ClientProxy,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {
    super(dataSource);
  }

  protected async execute(
    data: UpdateUserObj,
    manager: EntityManager,
  ): Promise<User> {
    data.currentUser = data.currentUser || data.user;
    const updatedUser = await this.userService.updateWithEntityManager(
      data.payload,
      data.user,
      manager,
    );
    await this.bankClientProxy
      .send('updated_user', { updatedUser, currentUser: data.currentUser })
      .toPromise();
    await this.notificationClientProxy
      .send('updated_user', { updatedUser, currentUser: data.currentUser })
      .toPromise();
    return updatedUser;
  }
}
