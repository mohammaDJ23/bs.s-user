import { Controller } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { UserService } from '../services';
import { User } from 'src/entities';
import {
  FindUserByEmailObj,
  FindUserByIdObj,
  UpdatedUserPartialObj,
} from 'src/types';

@Controller('/message-pattenrs/v1/user')
export class UserMessagePatternController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern('update_user')
  updatePartial(
    @Payload() payload: UpdatedUserPartialObj,
    @Ctx() context: RmqContext,
  ): Promise<User> {
    return this.userService.updateByMicroservice(context, payload.payload);
  }

  @MessagePattern('find_user_by_id')
  findById(
    @Payload() payload: FindUserByIdObj,
    @Ctx() context: RmqContext,
  ): Promise<User> {
    return this.userService.findByIdByMicroservice(context, payload.payload);
  }

  @MessagePattern('find_user_by_email')
  findByEmail(
    @Payload() payload: FindUserByEmailObj,
    @Ctx() context: RmqContext,
  ): Promise<User> {
    return this.userService.findByEmailByMicroservice(context, payload.payload);
  }
}
