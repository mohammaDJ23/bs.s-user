import { FieldValue } from '@google-cloud/firestore';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmptyObject,
  IsNumber,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export enum MessageStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface MessageObj {
  id: string;
  userId: number;
  text: string;
  isReaded: boolean;
  status: MessageStatus;
  createdAt: FieldValue;
  updatedAt: FieldValue;
  deletedAt: FieldValue | null;
}

export class MessageDto {
  @IsUUID()
  @ApiProperty()
  id: string;

  @IsNumber()
  @ApiProperty()
  userId: number;

  @IsString()
  @ApiProperty()
  text: string;

  @IsBoolean()
  @ApiProperty()
  isReaded: boolean;

  @IsEnum(MessageStatus)
  @ApiProperty({ enum: [MessageStatus] })
  status: MessageStatus;

  @ValidateNested()
  @Type(() => FieldValue)
  @IsNotEmptyObject()
  @ApiProperty()
  createdAt: FieldValue;

  @ValidateNested()
  @Type(() => FieldValue)
  @IsNotEmptyObject()
  @ApiProperty()
  updatedAt: FieldValue;

  @ValidateNested()
  @Type(() => FieldValue)
  @IsNotEmptyObject()
  @ValidateIf((object, value) => value !== null)
  @ApiProperty()
  deletedAt: FieldValue | null;
}
