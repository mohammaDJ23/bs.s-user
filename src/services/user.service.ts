import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import {
  CreateUserDto,
  UpdateUserByUserDto,
  UserQuantitiesDto,
  LastWeekDto,
  UpdateUserByOwnerDto,
  UpdateUserDto,
} from '../dtos';
import { User } from '../entities';
import { hash } from 'bcryptjs';
import { RmqContext, RpcException } from '@nestjs/microservices';
import {
  UserRoles,
  PartialUser,
  FindUserByIdObj,
  FindUserByEmailObj,
} from '../types';
import { RabbitmqService } from './rabbitmq.service';
import { UserListFiltersDto } from 'src/dtos/userListFilters.dto';
import { DeletedUserListFiltersDto } from 'src/dtos/deletedUserListFilters.dto';
import {
  CreateUserTransaction,
  DeleteUserByOwnerTransaction,
  DeleteUserTransaction,
  RestoreUserTransaction,
  UpdateUserByOwnerTransaction,
  UpdateUserTransaction,
} from 'src/transactions';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly rabbitmqService: RabbitmqService,
    @Inject(forwardRef(() => RestoreUserTransaction))
    private readonly restoreUserTransaction: RestoreUserTransaction,
    @Inject(forwardRef(() => DeleteUserTransaction))
    private readonly deleteUserTransaction: DeleteUserTransaction,
    @Inject(forwardRef(() => DeleteUserByOwnerTransaction))
    private readonly deleteUserByOwnerTransaction: DeleteUserByOwnerTransaction,
    @Inject(forwardRef(() => UpdateUserTransaction))
    private readonly updateUserTransaction: UpdateUserTransaction,
    @Inject(forwardRef(() => UpdateUserByOwnerTransaction))
    private readonly updateUserByOwnerTransaction: UpdateUserByOwnerTransaction,
    @Inject(forwardRef(() => CreateUserTransaction))
    private readonly createUserTransaction: CreateUserTransaction,
  ) {}

  async createWithEntityManager(
    manager: EntityManager,
    payload: CreateUserDto,
    user: User,
  ): Promise<User> {
    let findedUser = await manager
      .createQueryBuilder(User, 'public.user')
      .withDeleted()
      .where('public.user.email = :email', { email: payload.email })
      .getOne();

    if (findedUser) throw new ConflictException('The user already exist.');

    payload.password = await hash(payload.password, 10);
    let newUser = manager.create(User);
    newUser = Object.assign(newUser, payload);
    newUser.parent = user;
    newUser = await manager.save(newUser);
    return newUser;
  }

  async create(payload: CreateUserDto, user: User): Promise<User> {
    return this.createUserTransaction.run(payload, user);
  }

  async updateWithEntityManager(
    manager: EntityManager,
    payload: UpdateUserDto,
    user: User,
  ) {
    if (payload.email !== user.email) {
      const existedUser = await manager
        .createQueryBuilder(User, 'public.user')
        .withDeleted()
        .where('public.user.id != :id')
        .andWhere('public.user.email = :email')
        .setParameters({ id: user.id, email: payload.email })
        .getOne();

      if (existedUser) {
        throw new BadRequestException('A user exists with the email.');
      }
    }

    const newUser = Object.assign(user, payload, { updatedAt: new Date() });
    return manager
      .createQueryBuilder(User, 'public.user')
      .update()
      .set(newUser)
      .where('public.user.id = :id')
      .andWhere('public.user.created_by = :parentId')
      .setParameters({ id: user.id, parentId: user.parent.id })
      .returning('*')
      .exe({ noEffectError: 'Could not update the user.' });
  }

  async updateByUser(payload: UpdateUserByUserDto, user: User): Promise<User> {
    return this.updateUserTransaction.run(payload, user);
  }

  async updateByOwnerWithEntityManager(
    manager: EntityManager,
    id: number,
    parentId: number,
    payload: UpdateUserByOwnerDto,
  ) {
    const existedUser = await manager
      .createQueryBuilder(User, 'public.user')
      .withDeleted()
      .where('public.user.id != :id')
      .andWhere('public.user.email = :email')
      .setParameters({ id, email: payload.email })
      .getOne();

    if (existedUser) {
      throw new BadRequestException('A user exists with the email.');
    }

    const findedUser = await this.findByIdOrFail(id);
    const newUser = Object.assign(findedUser, payload, {
      updatedAt: new Date(),
    });
    return manager
      .createQueryBuilder(User, 'public.user')
      .update()
      .set(newUser)
      .where('public.user.id = :id')
      .andWhere('public.user.created_by = :parentId')
      .setParameters({ id, parentId })
      .returning('*')
      .exe({ noEffectError: 'Could not update the user.' });
  }

  async updateByOwner(
    id: number,
    parentId: number,
    payload: UpdateUserByOwnerDto,
    user: User,
  ): Promise<User> {
    return this.updateUserByOwnerTransaction.run(id, parentId, payload, user);
  }

  async updateByMicroservice(
    context: RmqContext,
    payload: PartialUser,
  ): Promise<User> {
    try {
      const user = await this.findByIdOrFail(payload.id);
      const updatedUser = await this.updateUserTransaction.run(payload, user);
      this.rabbitmqService.applyAcknowledgment(context);
      return updatedUser;
    } catch (error) {
      throw new RpcException(error);
    }
  }

  deleteWithEntityManager(manager: EntityManager, user: User): Promise<User> {
    return manager
      .createQueryBuilder(User, 'public.user')
      .softDelete()
      .where('public.user.id = :id')
      .andWhere('public.user.deleted_at IS NULL')
      .andWhere('public.user.created_by = :parentId')
      .setParameters({ id: user.id, parentId: user.parent.id })
      .returning('*')
      .exe({ noEffectError: 'Could not delete the user.' });
  }

  async deleteByUser(user: User): Promise<User> {
    return this.deleteUserTransaction.run(user);
  }

  deleteByOwnerWithEntityManager(
    entityManager: EntityManager,
    id: number,
    parentId: number,
  ): Promise<User> {
    return entityManager
      .createQueryBuilder(User, 'public.user')
      .softDelete()
      .where('public.user.id = :id')
      .andWhere('public.user.deleted_at IS NULL')
      .andWhere('public.user.created_by = :parentId')
      .setParameters({ id, parentId })
      .returning('*')
      .exe({ noEffectError: 'Could not delete the user.' });
  }

  async deleteByOwner(id: number, parentId: number, user: User): Promise<User> {
    return this.deleteUserByOwnerTransaction.run(id, parentId, user);
  }

  findById(id: number): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.parent', 'parent')
      .where('user.id = :id')
      .setParameters({ id })
      .getOne();
  }

  findByIdOrFail(id: number): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.parent', 'parent')
      .where('user.id = :id')
      .setParameters({ id })
      .getOneOrFail();
  }

  async findByIdOrFailByMicroservice(
    context: RmqContext,
    payload: FindUserByIdObj['payload'],
  ): Promise<User> {
    try {
      return this.findByIdOrFail(payload.id);
    } catch (error) {
      throw new RpcException(error);
    } finally {
      this.rabbitmqService.applyAcknowledgment(context);
    }
  }

  async findByIdByMicroservice(
    context: RmqContext,
    payload: FindUserByIdObj['payload'],
  ): Promise<User> {
    try {
      return this.findById(payload.id);
    } catch (error) {
      throw new RpcException(error);
    } finally {
      this.rabbitmqService.applyAcknowledgment(context);
    }
  }

  findByEmail(email: string): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.parent', 'parent')
      .where('user.email = :email')
      .setParameters({ email })
      .getOne();
  }

  findByEmailOrFail(email: string): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.parent', 'parent')
      .where('user.email = :email')
      .setParameters({ email })
      .getOneOrFail();
  }

  findByEmailWithDeleted(email: string): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.email = :email')
      .setParameters({ email })
      .getOne();
  }

  async findByEmailOrFailByMicroservice(
    context: RmqContext,
    payload: FindUserByEmailObj['payload'],
  ): Promise<User> {
    try {
      return this.findByEmailOrFail(payload.email);
    } catch (error) {
      throw new RpcException(error);
    } finally {
      this.rabbitmqService.applyAcknowledgment(context);
    }
  }

  async findByEmailByMicroservice(
    context: RmqContext,
    payload: FindUserByEmailObj['payload'],
  ): Promise<User> {
    try {
      return this.findByEmail(payload.email);
    } catch (error) {
      throw new RpcException(error);
    } finally {
      this.rabbitmqService.applyAcknowledgment(context);
    }
  }

  findAll(
    page: number,
    take: number,
    filters: UserListFiltersDto,
  ): Promise<[User[], number]> {
    return this.userRepository
      .createQueryBuilder('user')
      .take(take)
      .skip((page - 1) * take)
      .orderBy('user.createdAt', 'DESC')
      .where(
        new Brackets((query) =>
          query
            .where('to_tsvector(user.firstName) @@ plainto_tsquery(:q)')
            .orWhere('to_tsvector(user.lastName) @@ plainto_tsquery(:q)')
            .orWhere('to_tsvector(user.phone) @@ plainto_tsquery(:q)')
            .orWhere("user.firstName ILIKE '%' || :q || '%'")
            .orWhere("user.lastName ILIKE '%' || :q || '%'")
            .orWhere("user.phone ILIKE '%' || :q || '%'"),
        ),
      )
      .andWhere('user.role = ANY(:roles)')
      .andWhere(
        'CASE WHEN (:fromDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.createdAt)) * 1000, 0)::BIGINT >= (:fromDate)::BIGINT ELSE TRUE END',
      )
      .andWhere(
        'CASE WHEN (:toDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.createdAt)) * 1000, 0)::BIGINT <= (:toDate)::BIGINT ELSE TRUE END',
      )
      .setParameters({
        q: filters.q,
        roles: filters.roles,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      })
      .getManyAndCount();
  }

  quantities(): Promise<UserQuantitiesDto> {
    return this.userRepository
      .createQueryBuilder('user')
      .select('COALESCE(COUNT(user.id), 0)::INTEGER', 'quantities')
      .addSelect(
        `COALESCE(SUM((user.role = :owner)::INTEGER), 0)::INTEGER`,
        'ownerQuantities',
      )
      .addSelect(
        `COALESCE(SUM((user.role = :admin)::INTEGER), 0)::INTEGER`,
        'adminQuantities',
      )
      .addSelect(
        `COALESCE(SUM((user.role = :user)::INTEGER), 0)::INTEGER`,
        'userQuantities',
      )
      .setParameters({
        owner: UserRoles.OWNER,
        admin: UserRoles.ADMIN,
        user: UserRoles.USER,
      })
      .getRawOne();
  }

  quantitiesDeleted(): Promise<UserQuantitiesDto> {
    return this.userRepository
      .createQueryBuilder('user')
      .select('COALESCE(COUNT(user.id), 0)::INTEGER', 'quantities')
      .addSelect(
        `COALESCE(SUM((user.role = :owner)::INTEGER), 0)::INTEGER`,
        'ownerQuantities',
      )
      .addSelect(
        `COALESCE(SUM((user.role = :admin)::INTEGER), 0)::INTEGER`,
        'adminQuantities',
      )
      .addSelect(
        `COALESCE(SUM((user.role = :user)::INTEGER), 0)::INTEGER`,
        'userQuantities',
      )
      .withDeleted()
      .where('user.deletedAt IS NOT NULL')
      .setParameters({
        owner: UserRoles.OWNER,
        admin: UserRoles.ADMIN,
        user: UserRoles.USER,
      })
      .getRawOne();
  }

  lastWeek(): Promise<LastWeekDto[]> {
    return this.userRepository.query(
      `
        WITH lastWeek (date) AS (
          VALUES
            (NOW()),
            (NOW() - INTERVAL '1 DAY'),
            (NOW() - INTERVAL '2 DAY'),
            (NOW() - INTERVAL '3 DAY'),
            (NOW() - INTERVAL '4 DAY'),
            (NOW() - INTERVAL '5 DAY'),
            (NOW() - INTERVAL '6 DAY')
        )
        SELECT
          COALESCE(EXTRACT(EPOCH FROM lastWeek.date) * 1000, 0)::BIGINT AS date,
          COUNT(public.user.created_at)::INTEGER as count
        FROM lastWeek
        FULL JOIN 
          public.user ON to_char(lastWeek.date, 'YYYY-MM-DD') = to_char(public.user.created_at, 'YYYY-MM-DD') AND 
          public.user.deleted_at IS NULL
        WHERE lastWeek.date IS NOT NULL
        GROUP BY lastWeek.date
        ORDER BY lastWeek.date ASC;
      `,
    );
  }

  findAllDeleted(
    page: number,
    take: number,
    filters: DeletedUserListFiltersDto,
  ): Promise<[User[], number]> {
    return this.userRepository
      .createQueryBuilder('user')
      .take(take)
      .skip((page - 1) * take)
      .withDeleted()
      .orderBy('user.deletedAt', 'DESC')
      .where('user.deletedAt IS NOT NULL')
      .andWhere(
        new Brackets((query) =>
          query
            .where('to_tsvector(user.firstName) @@ plainto_tsquery(:q)')
            .orWhere('to_tsvector(user.lastName) @@ plainto_tsquery(:q)')
            .orWhere('to_tsvector(user.phone) @@ plainto_tsquery(:q)')
            .orWhere("user.firstName ILIKE '%' || :q || '%'")
            .orWhere("user.lastName ILIKE '%' || :q || '%'")
            .orWhere("user.phone ILIKE '%' || :q || '%'"),
        ),
      )
      .andWhere('user.role = ANY(:roles)')
      .andWhere(
        'CASE WHEN (:fromDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.createdAt)) * 1000, 0)::BIGINT >= (:fromDate)::BIGINT ELSE TRUE END',
      )
      .andWhere(
        'CASE WHEN (:toDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.createdAt)) * 1000, 0)::BIGINT <= (:toDate)::BIGINT ELSE TRUE END',
      )
      .andWhere(
        'CASE WHEN (:deletedDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.deletedAt)) * 1000, 0)::BIGINT = (:deletedDate)::BIGINT ELSE TRUE END',
      )
      .setParameters({
        q: filters.q,
        roles: filters.roles,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        deletedDate: filters.deletedDate,
      })
      .getManyAndCount();
  }

  async findByIdDeleted(id: number): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .withDeleted()
      .leftJoinAndSelect('user.parent', 'parent')
      .where('user.id = :id')
      .andWhere('user.deletedAt IS NOT NULL')
      .setParameters({ id })
      .getOne();
  }

  restoreOneWithEntityManager(
    manager: EntityManager,
    id: number,
    parentId: number,
  ): Promise<User> {
    return manager
      .createQueryBuilder(User, 'public.user')
      .restore()
      .where('public.user.id = :id')
      .andWhere('public.user.deleted_at IS NOT NULL')
      .andWhere('public.user.created_by = :parentId')
      .setParameters({ id, parentId })
      .returning('*')
      .exe({ noEffectError: 'Could not restore the user.' });
  }

  async restore(id: number, parentId: number, user: User): Promise<User> {
    return this.restoreUserTransaction.run(id, parentId, user);
  }
}
