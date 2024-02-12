import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';
import { Expose } from 'class-transformer';

export class UserConnectionStatusDto extends UserDto {
  @Expose()
  @ApiProperty()
  lastConnection: string | null;

  @Expose()
  @ApiProperty()
  agents: Record<string, string>;
}
