import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lump_metallurgy_prop')
export class LumpMetallurgyProp {
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  @Column({ comment: '块矿名称' })
  name: string;

  @Column('json', { nullable: true, comment: '冶金性能指标（JSON）' })
  properties: Record<string, any>;

  @Column({ nullable: true, comment: '修改者' })
  modifier: string;

  @CreateDateColumn({ comment: '创建时间' })
  created_at: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_at: Date;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;
}
