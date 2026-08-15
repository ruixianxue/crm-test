import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactEntity } from './contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { ColumnsService } from '../columns/columns.service';
import { ColumnType } from '../columns/column.entity';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly repo: Repository<ContactEntity>,
    private readonly columnsService: ColumnsService,
  ) {}

  create(dto: CreateContactDto) {
    const contact = this.repo.create({ data: dto.data });
    return this.repo.save(contact);
  }

  async update(id: string, dto: UpdateContactDto) {
    const contact = await this.repo.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    contact.data = { ...contact.data, ...dto.data }; // merge, not replace
    return this.repo.save(contact);
  }

  async remove(id: string) {
    const result = await this.repo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Contact not found');
  }

  async findAll(query: QueryContactsDto) {
    const { offset, limit, sortBy, sortDir, filterBy, filterValue } = query;
    const qb = this.repo.createQueryBuilder('contact');

    if (filterBy) {
      const column = await this.columnsService.findByKey(filterBy);
      if (!column) {
        throw new BadRequestException(`Unknown filter column "${filterBy}"`);
      }
      const jsonExpr = `contact.data->>'${column.key}'`;
      if (filterValue !== undefined && filterValue !== '') {
        switch (column.type) {
          case ColumnType.NUMBER: {
            const numericValue = Number(filterValue);
            if (Number.isNaN(numericValue)) {
              qb.andWhere('1 = 0');
            } else {
              qb.andWhere(`(${jsonExpr})::numeric = :filterValue`, {
                filterValue: numericValue,
              });
            }
            break;
          }
          case ColumnType.DATE: {
            // Support partial matches: "2024", "2024-06", or a full "2024-06-15"
            qb.andWhere(`${jsonExpr} LIKE :filterValue`, {
              filterValue: `${filterValue}%`,
            });
            break;
          }
          default: // text, phone -> partial, case-insensitive match
            qb.andWhere(`${jsonExpr} ILIKE :filterValue`, {
              filterValue: `%${filterValue}%`,
            });
        }
      }
    }

    if (sortBy) {
      const column = await this.columnsService.findByKey(sortBy);
      if (!column) {
        throw new BadRequestException(`Unknown sort column "${sortBy}"`);
      }
      const jsonExpr = `contact.data->>'${column.key}'`;
      const castExpr =
        column.type === ColumnType.NUMBER
          ? `(${jsonExpr})::numeric`
          : column.type === ColumnType.DATE
          ? `(${jsonExpr})::date`
          : jsonExpr;
      qb.orderBy(castExpr, sortDir, 'NULLS LAST');
      qb.addOrderBy('contact.id', 'ASC'); // tie-breaker: guarantees stable order across requests
    } else {
      qb.orderBy('contact.createdAt', 'ASC');
      qb.addOrderBy('contact.id', 'ASC'); // tie-breaker for rows with equal timestamps
    }

    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return {
      items,
      total,
      offset,
      limit,
      hasMore: offset + items.length < total,
    };
  }
}