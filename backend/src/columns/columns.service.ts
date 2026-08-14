import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ColumnEntity } from './column.entity';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto, UpdateColumnDto } from './dto/update-column.dto';

@Injectable()
export class ColumnsService {
  constructor(
    @InjectRepository(ColumnEntity)
    private readonly repo: Repository<ColumnEntity>,
  ) {}

  async create(dto: CreateColumnDto): Promise<ColumnEntity> {
    const existing = await this.repo.findOne({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException(`Column key "${dto.key}" already exists`);
    }
    const column = this.repo.create(dto);
    return this.repo.save(column);
  }

  findAll(): Promise<ColumnEntity[]> {
    return this.repo.find({ order: { position: 'ASC' } });
  }

  async update(id: string, dto: UpdateColumnDto): Promise<ColumnEntity> {
    const column = await this.repo.findOne({ where: { id } });
    if (!column) throw new NotFoundException('Column not found');
    Object.assign(column, dto);
    return this.repo.save(column);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Column not found');
  }

  async reorder(dto: ReorderColumnsDto): Promise<ColumnEntity[]> {
    for (const item of dto.items) {
      await this.repo.update(item.id, { position: item.position });
    }
    return this.findAll();
  }
  async findByKey(key: string): Promise<ColumnEntity | null> {
    return this.repo.findOne({ where: { key } });
  }
}