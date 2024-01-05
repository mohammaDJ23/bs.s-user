import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MakeRoomIdsDto {
  @IsString({ each: true })
  @ApiProperty()
  roomIds: string[];
}
