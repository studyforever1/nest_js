import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sj_econ_info')
export class SjEconInfo {
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  @Column({ comment: '原料名称' })
  name: string;

  @Column('json', { nullable: true, comment: '化学成分参数及其他指标，JSON格式' })
  composition: Record<string, any>;

  @Column({ comment: '修改者', nullable: true })
  modifier: string;

  @CreateDateColumn({ comment: '创建时间' })
  created_at: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_at: Date;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;
}

