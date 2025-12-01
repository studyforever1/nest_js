import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('gl_fuel_info')
export class GlFuelInfo {
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  @Column({ comment: '燃料名称' })
  name: string;

  @Column({ comment: '分类编号', nullable: true })
  category: string;

  @Column('json', { nullable: true, comment: '化学成分及其他指标，JSON格式' })
  composition: Record<string, any>;

  @Column({ type: 'float', default: 0, comment: '库存数量' })
  inventory: number;

  @Column({ comment: '修改者', nullable: true })
  modifier: string;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ type: 'text', nullable: true, comment: '备注信息' })
  remark: string;

  @CreateDateColumn({ comment: '创建时间' })
  created_at: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_at: Date;
}
