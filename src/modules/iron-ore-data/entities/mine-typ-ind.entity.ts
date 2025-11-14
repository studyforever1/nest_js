import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 矿山类型指标实体
 * 
 * 用于存储矿山的基本信息和质量指标
 * 特点：
 * - 包含矿山基本信息和质量指标
 * - 支持化学成分分析
 * - 包含价格信息
 * - 自动时间戳管理
 * 
 * @example
 * ```typescript
 * const mine = new MineTypInd();
 * mine.mineName = '某大型矿山';
 * mine.mineType = '露天矿';
 * mine.feGrade = 65.5;
 * mine.price = 520.0;
 * ```
 */
@Entity('mine_typ_ind')
export class MineTypInd {
  /** 记录唯一标识符 */
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: '记录ID', example: 'uuid-string' })
  id: string;

  /** 矿山名称 */
  @Column({ length: 100, comment: '矿山名称' })
  @ApiProperty({ description: '矿山名称', example: '某大型矿山', maxLength: 100 })
  mineName: string;

  /** 矿山类型，如露天矿、地下矿等 */
  @Column({ length: 50, comment: '矿山类型' })
  @ApiProperty({ description: '矿山类型', example: '露天矿', maxLength: 50 })
  mineType: string;

  // ========== 质量指标字段 ==========
  
  /** 铁品位，矿石中铁的含量 */
  @Column({ type: 'decimal', precision: 10, scale: 4, comment: '铁品位(%)' })
  @ApiProperty({ description: '铁品位(%)', example: 65.5, type: 'number' })
  feGrade: number;

  /** 二氧化硅含量，酸性氧化物 */
  @Column({ type: 'decimal', precision: 10, scale: 4, comment: 'SiO2含量(%)' })
  @ApiProperty({ description: 'SiO2含量(%)', example: 4.2, type: 'number' })
  sio2: number;

  /** 氧化铝含量，中性氧化物 */
  @Column({ type: 'decimal', precision: 10, scale: 4, comment: 'Al2O3含量(%)' })
  @ApiProperty({ description: 'Al2O3含量(%)', example: 1.8, type: 'number' })
  al2o3: number;

  /** 磷含量，有害元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, comment: 'P含量(%)' })
  @ApiProperty({ description: 'P含量(%)', example: 0.05, type: 'number' })
  p: number;

  /** 硫含量，有害元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, comment: 'S含量(%)' })
  @ApiProperty({ description: 'S含量(%)', example: 0.02, type: 'number' })
  s: number;

  /** 水分含量，影响原料质量 */
  @Column({ type: 'decimal', precision: 10, scale: 4, comment: '水分(%)' })
  @ApiProperty({ description: '水分(%)', example: 8.5, type: 'number' })
  moisture: number;

  /** 粒度，原料颗粒大小 */
  @Column({ type: 'decimal', precision: 10, scale: 4, comment: '粒度(mm)' })
  @ApiProperty({ description: '粒度(mm)', example: 6.3, type: 'number' })
  particleSize: number;

  // ========== 价格和备注字段 ==========
  
  /** 原料价格，单位：元/吨 */
  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '价格(元/吨)' })
  @ApiProperty({ description: '价格(元/吨)', example: 520.0, type: 'number' })
  price: number;

  /** 备注信息，可选的额外说明 */
  @Column({ length: 200, nullable: true, comment: '备注' })
  @ApiProperty({ description: '备注', example: '优质铁矿石', required: false })
  remarks?: string;

  // ========== 时间戳字段 ==========
  
  /** 记录创建时间，自动生成 */
  @CreateDateColumn({ comment: '创建时间' })
  @ApiProperty({ description: '创建时间', example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  /** 记录最后更新时间，自动更新 */
  @UpdateDateColumn({ comment: '更新时间' })
  @ApiProperty({ description: '更新时间', example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
