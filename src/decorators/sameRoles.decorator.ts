import { SetMetadata } from '@nestjs/common';
import { UserRoles } from 'src/types';

export const SameRoles = (...roles: UserRoles[]) =>
  SetMetadata('same-roles', roles);
