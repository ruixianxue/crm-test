import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ColumnsService } from './columns.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto, UpdateColumnDto } from './dto/update-column.dto';

@Controller('columns')
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @Get()
  findAll() {
    return this.columnsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateColumnDto) {
    return this.columnsService.create(dto);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderColumnsDto) {
    return this.columnsService.reorder(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateColumnDto) {
    return this.columnsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.columnsService.remove(id);
  }
}