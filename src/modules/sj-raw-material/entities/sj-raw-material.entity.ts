import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sj_raw_material')
export class SjRawMaterial {
  /** 主键ID */
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  /** 原料名称 */
  @Column({ comment: '原料名称' })
  name: string;

  /** 分类编号（可为空） */
  @Column({ comment: '分类编号', nullable: true })
  category: string;

  /** 化学成分参数及其他指标，如 TFe、SiO2、价格等，JSON格式 */
  @Column('json', { nullable: true, comment: '化学成分参数及其他指标，如 TFe、SiO2、价格等' })
  composition: Record<string, any>;

  /** 库存数量，默认0 */
  @Column({ type: 'float', default: 0, comment: '库存数量' })
  inventory: number;

  /** 产地，可为空 */
  @Column({ comment: '产地', nullable: true })
  origin: string;

  /** 修改者用户名，可为空 */
  @Column({ comment: '修改者', nullable: true })
  modifier: string;

  /** 是否启用，默认启用 */
  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  /** 备注信息，可为空 */
  @Column({ type: 'text', nullable: true, comment: '备注信息' })
  remark: string;

  /** 创建时间 */
  @CreateDateColumn({ comment: '创建时间' })
  created_at: Date;

  /** 更新时间 */
  @UpdateDateColumn({ comment: '更新时间' })
  updated_at: Date;
}
