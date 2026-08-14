import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactEntity } from './contact.entity';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { ColumnsModule } from '../columns/columns.module';

@Module({
  imports: [TypeOrmModule.forFeature([ContactEntity]), ColumnsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}