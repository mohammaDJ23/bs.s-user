import {
  Controller,
  Get,
  Delete,
  Post,
  Put,
  Body,
  UseGuards,
  Param,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from 'src/services';
import {
  CreateUserDto,
  UserDto,
  UpdateUserByUserDto,
  UpdateUserByOwnerDto,
  ErrorDto,
  UserQuantitiesDto,
  LastWeekDto,
  AccessTokenDto,
  UserListFiltersDto,
  DeletedUserListFiltersDto,
} from 'src/dtos';
import {
  CurrentUser,
  DissimilarRoles,
  ParentId,
  Roles,
  SameRoles,
} from 'src/decorators';
import {
  ApiBody,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  DissimilarRolesGuard,
  JwtGuard,
  RolesGuard,
  SameRolesGuard,
} from 'src/guards';
import { User } from 'src/entities';
import { UserRoles } from 'src/types';
import { ParseUserListFiltersPipe } from 'src/pipes';
import {
  LastWeekUsersSerializerInterceptor,
  UsersSerializerInterceptor,
  UserSerializerInterceptor,
  UserQuantitiesSerializerInterceptor,
  TokenizeInterceptor,
  DeletedUserSerializerInterceptor,
} from 'src/interceptors';

@UseGuards(JwtGuard)
@Controller('/api/v1/user')
@ApiTags('/api/v1/user')
export class userController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRoles.OWNER)
  @UseGuards(RolesGuard)
  @UseInterceptors(UserSerializerInterceptor)
  @ApiBody({ type: CreateUserDto })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.CREATED, type: UserDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.CONFLICT, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  create(
    @Body() body: CreateUserDto,
    @CurrentUser() user: User,
  ): Promise<User> {
    return this.userService.create(body, user);
  }

  @Put('update')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.ADMIN, UserRoles.USER)
  @UseGuards(RolesGuard)
  @UseInterceptors(TokenizeInterceptor)
  @ApiBody({ type: UpdateUserByUserDto })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: AccessTokenDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.CONFLICT, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  updateByUser(
    @Body() body: UpdateUserByUserDto,
    @CurrentUser() user: User,
  ): Promise<User> {
    return this.userService.updateByUser(body, user);
  }

  @Put('owner/update/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.OWNER)
  @DissimilarRoles(UserRoles.OWNER)
  @UseGuards(RolesGuard, DissimilarRolesGuard)
  @UseInterceptors(TokenizeInterceptor)
  @ApiBody({ type: UpdateUserByOwnerDto })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: AccessTokenDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.CONFLICT, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  updateByOwner(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserByOwnerDto,
    @ParentId() parentId: number,
    @CurrentUser() user: User,
  ): Promise<User> {
    return this.userService.updateByOwner(id, parentId, body, user);
  }

  @Delete('delete')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.ADMIN, UserRoles.USER)
  @UseGuards(RolesGuard)
  @UseInterceptors(UserSerializerInterceptor)
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  deleteByUser(@CurrentUser() user: User): Promise<User> {
    return this.userService.deleteByUser(user);
  }

  @Delete('owner/delete/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.OWNER)
  @DissimilarRoles(UserRoles.OWNER)
  @UseGuards(RolesGuard, DissimilarRolesGuard)
  @UseInterceptors(UserSerializerInterceptor)
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  deleteByOwner(
    @Param('id', ParseIntPipe) id: number,
    @ParentId() parentId: number,
    @CurrentUser() user: User,
  ): Promise<User> {
    return this.userService.deleteByOwner(id, parentId, user);
  }

  @Get('all')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.OWNER, UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @UseInterceptors(UsersSerializerInterceptor)
  @ApiQuery({ name: 'page', type: 'number' })
  @ApiQuery({ name: 'take', type: 'number' })
  @ApiQuery({ name: 'filters', type: UserListFiltersDto })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserDto, isArray: true })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  findAll(
    @Query('page', ParseIntPipe) page: number,
    @Query('take', ParseIntPipe) take: number,
    @Query('filters', ParseUserListFiltersPipe) filters: UserListFiltersDto,
  ): Promise<[User[], number]> {
    return this.userService.findAll(page, take, filters);
  }

  @Get('all/owners')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @UseInterceptors(UsersSerializerInterceptor)
  @ApiQuery({ name: 'page', type: 'number' })
  @ApiQuery({ name: 'take', type: 'number' })
  @ApiQuery({ name: 'filters', type: UserListFiltersDto })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserDto, isArray: true })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  findAllOwners(
    @Query('page', ParseIntPipe) page: number,
    @Query('take', ParseIntPipe) take: number,
    @Query('filters', ParseUserListFiltersPipe) filters: UserListFiltersDto,
  ): Promise<[User[], number]> {
    return this.userService.findAllOwners(page, take, filters);
  }

  @Get('all/deleted')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.OWNER)
  @UseGuards(RolesGuard)
  @UseInterceptors(UsersSerializerInterceptor)
  @ApiQuery({ name: 'page', type: 'number' })
  @ApiQuery({ name: 'take', type: 'number' })
  @ApiQuery({ name: 'filters', type: DeletedUserListFiltersDto })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserDto, isArray: true })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  findAllDeleted(
    @Query('page', ParseIntPipe) page: number,
    @Query('take', ParseIntPipe) take: number,
    @Query('filters', ParseUserListFiltersPipe)
    filters: DeletedUserListFiltersDto,
  ): Promise<[User[], number]> {
    return this.userService.findAllDeleted(page, take, filters);
  }

  @Get('quantities')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.OWNER, UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @UseInterceptors(UserQuantitiesSerializerInterceptor)
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserQuantitiesDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  quantities(): Promise<UserQuantitiesDto> {
    return this.userService.quantities();
  }

  @Get('deleted-quantities')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.OWNER, UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @UseInterceptors(UserQuantitiesSerializerInterceptor)
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserQuantitiesDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  quantitiesDeleted(): Promise<UserQuantitiesDto> {
    return this.userService.quantitiesDeleted();
  }

  @Get('last-week')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.OWNER, UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @UseInterceptors(LastWeekUsersSerializerInterceptor)
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: LastWeekDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  lastWeek(): Promise<LastWeekDto[]> {
    return this.userService.lastWeek();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @SameRoles(UserRoles.ADMIN, UserRoles.USER)
  @DissimilarRoles(UserRoles.OWNER)
  @UseGuards(SameRolesGuard, DissimilarRolesGuard)
  @UseInterceptors(UserSerializerInterceptor)
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  findByIdOrFail(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.userService.findByIdOrFail(id);
  }

  @Get('deleted/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.OWNER)
  @UseGuards(RolesGuard)
  @UseInterceptors(DeletedUserSerializerInterceptor)
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  async findByIdDeleted(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.userService.findByIdDeleted(id);
  }

  @Post('restore/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoles.OWNER)
  @UseGuards(RolesGuard)
  @UseInterceptors(UserSerializerInterceptor)
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBearerAuth()
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorDto })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, type: ErrorDto })
  restore(
    @Param('id', ParseIntPipe) id: number,
    @ParentId() parentId: number,
    @CurrentUser() user: User,
  ): Promise<User> {
    return this.userService.restore(id, parentId, user);
  }
}
