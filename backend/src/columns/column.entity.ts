import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ColumnType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  PHONE = 'phone',
}

@Entity('columns')
export class ColumnEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'enum', enum: ColumnType, default: ColumnType.TEXT })
  type: ColumnType;

  @Column({ type: 'int' })
  position: number;

  @CreateDateColumn()
  createdAt: Date;
}