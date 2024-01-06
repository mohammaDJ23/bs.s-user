import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsUUID, MinLength } from 'class-validator';

export class StopingTextDto {
  @IsString()
  @MinLength(3)
  @ApiProperty()
  roomId: string;

  @IsNumber()
  @ApiProperty()
  userId: number;

  @IsUUID()
  @ApiProperty()
  conversationId: string;
}
