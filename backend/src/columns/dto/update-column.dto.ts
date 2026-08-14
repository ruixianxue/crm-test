import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateColumnDto {
  @IsOptional()
  @IsString()
  label?: string;
}

class ReorderItem {
  @IsString()
  id: string;

  @IsInt()
  position: number;
}

export class ReorderColumnsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[];
}