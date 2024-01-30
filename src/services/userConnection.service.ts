import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { CacheKeys } from 'src/types';
import { Cache } from 'cache-manager';
import { plainToClass } from 'class-transformer';
import { UserConnectionStatusDto } from 'src/dtos';

export interface ConnectionStatusObj
  extends Pick<UserConnectionStatusDto, 'lastConnection' | 'agents'> {}

export type UsersStatusType = Record<number, UserConnectionStatusDto>;

@Injectable()
export class UserConnectionService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheService: Cache) {}

  getCacheKey(id: number) {
    return `${CacheKeys.USERS_STATUS}.${process.env.PORT}.${id}`;
  }

  getUserStatus(id: number): Promise<UserConnectionStatusDto | undefined> {
    const cacheKey = this.getCacheKey(id);
    return this.cacheService.get(cacheKey);
  }

  async setUserStatus(user: UserConnectionStatusDto): Promise<void> {
    const cacheKey = this.getCacheKey(user.id);
    await this.cacheService.set(
      cacheKey,
      user,
      // 6 months
      15778476000,
    );
  }

  convertUserStatusToUsersStatus(
    user: UserConnectionStatusDto,
  ): UsersStatusType {
    return {
      [user.id]: plainToClass(UserConnectionStatusDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }
}
