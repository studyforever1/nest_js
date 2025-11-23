import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BizModule } from './biz-module.entity';
import { User } from './../../modules/user/entities/user.entity';
import { ParameterHistory } from './parameter-history.entity';
import { Task } from './task.entity';

@Entity('config_group')
export class ConfigGroup {
  @PrimaryGeneratedColumn()
  group_id: number;

  @ManyToOne(() => User, (user) => user.configGroups)
  user: User;

  @ManyToOne(() => BizModule, (module) => module.configGroups)
  module: BizModule;

  @Column({ type: 'json', comment: '保存模块参数, 可分原料/化学/其他' })
  config_data: any;

  @Column({ default: true })
  is_latest: boolean;

  @Column({ default: false })
  is_shared: boolean;

  /** ⭐ 新增字段：是否为默认参数组 */
  @Column({ default: false, comment: '是否为默认参数组' })
  is_default: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /** 历史快照 */
  @OneToMany(() => ParameterHistory, (history) => history.group)
  history: ParameterHistory[];

  /** 使用该参数组的任务 */
  @OneToMany(() => Task, (task) => task.configGroup)
  tasks: Task[];
}
