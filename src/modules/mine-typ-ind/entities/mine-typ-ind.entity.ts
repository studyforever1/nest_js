import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mine_typ_ind')
export class MineTypInd {
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  @Column({ comment: '矿山名称' })
  name: string;

  @Column('json', {
    nullable: true,
    comment: '典型指标（JSON）',
  })
  indicators: Record<string, any>;

  @Column({ nullable: true, comment: '修改者' })
  modifier: string;

  @CreateDateColumn({ comment: '创建时间' })
  created_at: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_at: Date;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;
}
