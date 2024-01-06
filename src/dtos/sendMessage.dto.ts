import {
  IsNotEmptyObject,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { MessageDto } from './message.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @ValidateNested()
  @Type(() => MessageDto)
  @IsNotEmptyObject()
  @ApiProperty()
  message: MessageDto;

  @IsString()
  @ApiProperty()
  roomId: string;

  @IsUUID()
  @ApiProperty()
  conversationId: string;
}
