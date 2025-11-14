import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('fines_ht_base_prop')
export class FinesHtBaseProp {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: '记录ID', example: 'uuid-string' })
  id: string;

  @Column({ length: 100, comment: '原料名称' })
  @ApiProperty({ description: '原料名称', example: '粉矿', maxLength: 100 })
  materialName: string;

  @CreateDateColumn({ comment: '创建时间' })
  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  @ApiProperty({ description: '更新时间', example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
