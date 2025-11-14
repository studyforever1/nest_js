import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('lump_pellet_ht_prop')
export class LumpPelletHtProp {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: '记录ID', example: 'uuid-string' })
  id: string;

  @Column({ length: 100, comment: '原料名称' })
  @ApiProperty({ description: '原料名称', example: '块矿/球团', maxLength: 100 })
  materialName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '软化温度(°C)' })
  @ApiProperty({ description: '软化温度(°C)', example: 1200.0, type: 'number' })
  softeningTemp: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '熔化温度(°C)' })
  @ApiProperty({ description: '熔化温度(°C)', example: 1350.0, type: 'number' })
  meltingTemp: number;

  @CreateDateColumn({ comment: '创建时间' })
  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  @ApiProperty({ description: '更新时间', example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
