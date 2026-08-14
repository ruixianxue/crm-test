import { IsObject } from 'class-validator';

export class UpdateContactDto {
  @IsObject()
  data: Record<string, string | number | null>;
}