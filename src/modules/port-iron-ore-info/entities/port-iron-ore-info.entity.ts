import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('port_iron_ore_info')
export class PortIronOreInfo {
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  /** 矿粉名称 */
  @Column({ comment: '矿粉名称' })
  name: string;

  /** 港口 */
  @Column({ comment: '港口', nullable: true })
  port: string;

  /** 化学成分 / 指标 */
  @Column('json', {
    nullable: true,
    comment: '化学成分参数及其他指标，如 TFe、SiO2、价格等',
  })
  composition: Record<string, any>;

  /** 库存 */
  @Column({ type: 'float', default: 0, comment: '库存数量' })
  inventory: number;

  /** 是否启用 */
  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  /** 备注 */
  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  /** 修改人 */
  @Column({ nullable: true, comment: '修改人' })
  modifier: string;

  @CreateDateColumn({ comment: '创建时间' })
  created_at: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_at: Date;
}
