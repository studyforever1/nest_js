import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sj_raw_material')
export class SjRawMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '分类编号', nullable: true })
  category: string;

  @Column({ comment: '原料名称' })
  name: string;

  @Column('json', { nullable: true, comment: '化学成分参数及其他指标' })
  composition: Record<string, any>; // JSON 存储成分和指标，如 TFe、SiO2、价格等

  @Column({ comment: '产地', nullable: true })
  origin: string;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ comment: '修改者', nullable: true })
  modifier: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'text', nullable: true, comment: '备注信息' })
  remark: string;
}
