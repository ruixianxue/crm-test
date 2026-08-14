import { IsObject } from 'class-validator';

export class CreateContactDto {
  @IsObject()
  data: Record<string, string | number | null>;
}