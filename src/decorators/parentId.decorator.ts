import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { getCurrentUser, getParams } from 'src/libs';
import { UserRoles } from 'src/types';

export const ParentId = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const params = getParams(context);
    const user = getCurrentUser(context);
    if (user.role === UserRoles.OWNER) {
      if (params.id) {
        const userId = +params.id;
        if (userId) {
          if (userId === user.id) {
            return user.parent.id;
          }
          return user.id;
        }
        return 0;
      }
    }
    throw new BadRequestException(
      'you have to be an owner to get the parent id.',
    );
  },
);
