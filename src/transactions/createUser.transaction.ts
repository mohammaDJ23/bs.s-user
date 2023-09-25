import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { UserService } from 'src/services';
import { CreateUserObj } from 'src/types';
import { DataSource, EntityManager } from 'typeorm';
import { BaseTransaction } from './base.transaction';
import { ClientProxy } from '@nestjs/microservices';
import { User } from 'src/entities';

@Injectable()
export class CreateUserTransaction extends BaseTransaction<
  CreateUserObj,
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
    data: CreateUserObj,
    manager: EntityManager,
  ): Promise<User> {
    const createdUser = await this.userService.createWithEntityManager(
      data.payload,
      data.currentUser,
      manager,
    );
    await this.clientProxy
      .send('created_user', { createdUser, currentUser: data.currentUser })
      .toPromise();
    return createdUser;
  }
}
