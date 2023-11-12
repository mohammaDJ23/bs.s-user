import { ExecutionContext } from '@nestjs/common';
import { getCurrentUser } from './currentUser';

export function getCacheKey(context: ExecutionContext): string {
  const user = getCurrentUser(context);
  const id = user.id;
  return `${id}.${process.env.PORT}`;
}
