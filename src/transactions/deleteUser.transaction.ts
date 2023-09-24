import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { UserService } from 'src/services';
import { DeleteUserObj } from 'src/types';
import { DataSource, EntityManager } from 'typeorm';
import { BaseTransaction } from './base.transaction';
import { ClientProxy } from '@nestjs/microservices';
import { User } from 'src/entities';

@Injectable()
export class DeleteUserTransaction extends BaseTransaction<
  DeleteUserObj,
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
    data: DeleteUserObj,
    manager: EntityManager,
  ): Promise<User> {
    const deletedUser = await this.userService.deleteWithEntityManager(
      data.id,
      data.user.id,
      manager,
    );
    await this.clientProxy
      .send('deleted_user', { deletedUser, currentUser: data.user })
      .toPromise();
    return deletedUser;
  }
}
