import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { UserService } from 'src/services';
import { NotificationObj } from 'src/types';
import { DataSource, EntityManager } from 'typeorm';
import { BaseTransaction } from './base.transaction';
import { ClientProxy } from '@nestjs/microservices';
import { User } from 'src/entities';
import { CreateUserDto } from 'src/dtos';

@Injectable()
export class CreateUserTransaction extends BaseTransaction {
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
    manager: EntityManager,
    payload: CreateUserDto,
    user: User,
  ): Promise<User> {
    const createdUser = await this.userService.createWithEntityManager(
      manager,
      payload,
      user,
    );
    await this.bankClientProxy
      .send('created_user', { payload: createdUser, user })
      .toPromise();
    await this.notificationClientProxy
      .emit<string, NotificationObj>('notification_to_owners', {
        payload: {
          data: JSON.stringify({
            type: 'created_user',
            title: 'A new user was created.',
            createdUser,
          }),
        },
        user,
      })
      .toPromise();
    return createdUser;
  }
}
