import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { ColumnType } from '../column.entity';

export class CreateColumnDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'key must be alphanumeric/underscore only',
  })
  key: string;

  @IsString()
  label: string;

  @IsEnum(ColumnType)
  type: ColumnType;

  @IsOptional()
  position?: number;
}