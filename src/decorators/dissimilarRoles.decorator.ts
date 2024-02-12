import { SetMetadata } from '@nestjs/common';
import { UserRoles } from 'src/types';

export const DissimilarRoles = (...roles: UserRoles[]) =>
  SetMetadata('dissimilar-roles', roles);
