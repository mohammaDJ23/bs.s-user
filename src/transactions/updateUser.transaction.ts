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
    @Inject(process.env.USER_RABBITMQ_SERVICE)
    private readonly clientProxy: ClientProxy,
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
    await this.clientProxy
      .send('updated_user', { updatedUser, currentUser: data.currentUser })
      .toPromise();
    return updatedUser;
  }
}
