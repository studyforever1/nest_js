import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('coal_econ_info')
export class CoalEconInfo {
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  @Column({ comment: '煤炭名称' })
  name: string;

  @Column('json', {
    nullable: true,
    comment: '化学成分及经济指标（JSON）',
  })
  composition: Record<string, any>;

  @Column({ nullable: true, comment: '修改者' })
  modifier: string;

  @CreateDateColumn({ comment: '创建时间' })
  created_at: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_at: Date;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;
}
