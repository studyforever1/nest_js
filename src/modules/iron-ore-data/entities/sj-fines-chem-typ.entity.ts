import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 烧结矿粉化学成分典型值实体
 * 
 * 用于存储烧结矿粉的化学成分数据，包括各种氧化物含量、价格信息等
 * 特点：
 * - 支持多种化学成分分析
 * - 包含价格和返矿率信息
 * - 自动时间戳管理
 * - 完整的API文档支持
 * 
 * @example
 * ```typescript
 * const material = new SjFinesChemTyp();
 * material.categoryCode = 'CAT001';
 * material.materialName = '烧结矿粉001';
 * material.tfe = 62.5;
 * material.cao = 8.5;
 * material.price = 500.0;
 * ```
 */
@Entity('sj_fines_chem_typ')
export class SjFinesChemTyp {
  /** 记录唯一标识符 */
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: '记录ID', example: 'uuid-string' })
  id: string;

  /** 分类编号，用于区分不同类型的原料 */
  @Column({ length: 50, comment: '分类编号' })
  @ApiProperty({ description: '分类编号', example: 'CAT001', maxLength: 50 })
  categoryCode: string;

  /** 原料名称，描述具体的原料类型 */
  @Column({ length: 100, comment: '原料名称' })
  @ApiProperty({ description: '原料名称', example: '烧结矿粉001', maxLength: 100 })
  materialName: string;

  // ========== 化学成分字段 ==========
  
  /** 全铁含量，主要成分指标 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'TFe含量(%)' })
  @ApiProperty({ description: 'TFe含量(%)', example: 62.5, type: 'number' })
  tfe: number;

  /** 氧化钙含量，碱性氧化物 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'CaO含量(%)' })
  @ApiProperty({ description: 'CaO含量(%)', example: 8.5, type: 'number' })
  cao: number;

  /** 二氧化硅含量，酸性氧化物 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'SiO2含量(%)' })
  @ApiProperty({ description: 'SiO2含量(%)', example: 4.8, type: 'number' })
  sio2: number;

  /** 氧化镁含量，碱性氧化物 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'MgO含量(%)' })
  @ApiProperty({ description: 'MgO含量(%)', example: 1.8, type: 'number' })
  mgo: number;

  /** 氧化铝含量，中性氧化物 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'Al2O3含量(%)' })
  @ApiProperty({ description: 'Al2O3含量(%)', example: 1.2, type: 'number' })
  al2o3: number;

  /** 硫含量，有害元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'S含量(%)' })
  @ApiProperty({ description: 'S含量(%)', example: 0.05, type: 'number' })
  s: number;

  /** 磷含量，有害元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'P含量(%)' })
  @ApiProperty({ description: 'P含量(%)', example: 0.08, type: 'number' })
  p: number;

  /** 二氧化钛含量，微量元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'TiO2含量(%)' })
  @ApiProperty({ description: 'TiO2含量(%)', example: 0.3, type: 'number' })
  tio2: number;

  /** 氧化锰含量，微量元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'MnO含量(%)' })
  @ApiProperty({ description: 'MnO含量(%)', example: 0.2, type: 'number' })
  mno: number;

  /** 铬含量，微量元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'Cr含量(%)' })
  @ApiProperty({ description: 'Cr含量(%)', example: 0.1, type: 'number' })
  cr: number;

  /** 铅含量，有害元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'Pb含量(%)' })
  @ApiProperty({ description: 'Pb含量(%)', example: 0.02, type: 'number' })
  pb: number;

  /** 锌含量，有害元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'Zn含量(%)' })
  @ApiProperty({ description: 'Zn含量(%)', example: 0.03, type: 'number' })
  zn: number;

  /** 氧化钾含量，微量元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'K2O含量(%)' })
  @ApiProperty({ description: 'K2O含量(%)', example: 0.05, type: 'number' })
  k2o: number;

  /** 氧化钠含量，微量元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'Na2O含量(%)' })
  @ApiProperty({ description: 'Na2O含量(%)', example: 0.04, type: 'number' })
  na2o: number;

  /** 镍含量，微量元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'Ni含量(%)' })
  @ApiProperty({ description: 'Ni含量(%)', example: 0.01, type: 'number' })
  ni: number;

  /** 五氧化二钒含量，微量元素 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'V2O5含量(%)' })
  @ApiProperty({ description: 'V2O5含量(%)', example: 0.02, type: 'number' })
  v2o5: number;

  /** 水分含量，影响原料质量 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: 'H2O含量(%)' })
  @ApiProperty({ description: 'H2O含量(%)', example: 1.5, type: 'number' })
  h2o: number;

  /** 烧失量，高温下的质量损失 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: '烧毁(%)' })
  @ApiProperty({ description: '烧毁(%)', example: 2.0, type: 'number' })
  burnOff: number;

  // ========== 价格相关字段 ==========
  
  /** 原料价格，单位：元/吨 */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '价格(元/吨)' })
  @ApiProperty({ description: '价格(元/吨)', example: 500.0, type: 'number' })
  price: number;

  /** 返矿率，未完全烧结的原料比例 */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0, comment: '返矿率(%)' })
  @ApiProperty({ description: '返矿率(%)', example: 5.0, type: 'number' })
  returnOreRate: number;

  /** 返矿价格，返矿原料的价格 */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '返矿价格(元/吨)' })
  @ApiProperty({ description: '返矿价格(元/吨)', example: 450.0, type: 'number' })
  returnOrePrice: number;

  /** 干基价格，去除水分后的价格 */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '干基价格(元/吨)' })
  @ApiProperty({ description: '干基价格(元/吨)', example: 480.0, type: 'number' })
  dryBasePrice: number;

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
