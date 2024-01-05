import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsString } from 'class-validator';

export class MakeRoomIdsDto {
  @IsString({ each: true })
  @ArrayNotEmpty()
  @ApiProperty()
  roomIds: string[];
}
