import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getCurrentUser, getParams } from 'src/libs';
import { UserService } from 'src/services';
import { UserRoles } from 'src/types';

@Injectable()
export class SameRolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRoles[]>(
      'same-roles',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const user = getCurrentUser(context);
    const params = getParams(context);

    if (!params.id) {
      throw new BadRequestException('Could not found the user id.');
    }

    const userId = +params.id;
    const findedUser = await this.userService.findById(userId);
    if (!findedUser) throw new NotFoundException('Could not found the user.');

    const findedRole = requiredRoles.find((role) => role === user.role);

    if (findedRole) {
      if (findedUser.role === findedRole) {
        return user.id === findedUser.id;
      }
      return false;
    }
    return true;
  }
}
