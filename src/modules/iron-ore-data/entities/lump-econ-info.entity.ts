import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 块矿经济信息实体
 * 
 * 用于存储块矿的经济信息，包括供应商和价格数据
 * 特点：
 * - 简化的经济信息结构
 * - 包含供应商信息
 * - 价格数据管理
 * - 自动时间戳管理
 * 
 * @example
 * ```typescript
 * const lumpInfo = new LumpEconInfo();
 * lumpInfo.supplierName = '某供应商';
 * lumpInfo.price = 500.0;
 * ```
 */
@Entity('lump_econ_info')
export class LumpEconInfo {
  /** 记录唯一标识符 */
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: '记录ID', example: 'uuid-string' })
  id: string;

  /** 供应商名称 */
  @Column({ length: 100, comment: '供应商名称' })
  @ApiProperty({ description: '供应商名称', example: '某供应商', maxLength: 100 })
  supplierName: string;

  /** 块矿价格，单位：元/吨 */
  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '价格(元/吨)' })
  @ApiProperty({ description: '价格(元/吨)', example: 500.0, type: 'number' })
  price: number;

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
