import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { UserService } from 'src/services';
import { DataSource, EntityManager } from 'typeorm';
import { BaseTransaction } from './base.transaction';
import { ClientProxy } from '@nestjs/microservices';
import { User } from 'src/entities';
import { UpdateUserDto } from 'src/dtos';

@Injectable()
export class UpdateUserTransaction extends BaseTransaction {
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
    payload: UpdateUserDto,
    user: User,
  ): Promise<User> {
    const updatedUser = await this.userService.updateWithEntityManager(
      manager,
      payload,
      user,
    );
    await this.bankClientProxy
      .send('updated_user', { payload: updatedUser, user })
      .toPromise();
    return updatedUser;
  }
}
