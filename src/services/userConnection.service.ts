import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { CacheKeys, Socket } from 'src/types';
import { Cache } from 'cache-manager';

export type UserStatusType = Socket['user'] & {
  lastConnection?: string | null;
};

export type UsersStatusType = Record<number, UserStatusType>;

@Injectable()
export class UserConnectionService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheService: Cache) {}

  getCacheKey(id: number) {
    return `${CacheKeys.USERS_STATUS}.${process.env.PORT}.${id}`;
  }

  getUserStatus(id: number): Promise<UserStatusType | undefined> {
    const cacheKey = this.getCacheKey(id);
    return this.cacheService.get(cacheKey);
  }

  async setUserStatus(user: UserStatusType): Promise<void> {
    const cacheKey = this.getCacheKey(user.id);
    await this.cacheService.set(
      cacheKey,
      user,
      // 6 months
      15778476000,
    );
  }

  convertUserStatusToUsersStatus(user: UserStatusType): UsersStatusType {
    return { [user.id]: user };
  }
}
