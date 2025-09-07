// common/database/entities/config-group.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Module } from './module.entity';
import { User } from './../../modules/user/entities/user.entity';
import { ParameterHistory } from './parameter-history.entity';

@Entity('config_group')
export class ConfigGroup {
  @PrimaryGeneratedColumn()
  group_id: number;

  @ManyToOne(() => User, (user) => user.configGroups)
  user: User;

  @ManyToOne(() => Module, (module) => module.configGroups)
  module: Module;

  @Column({ comment: '参数组名称' })
  group_name: string;

  @Column({ type: 'json', comment: '保存模块参数, 可分原料/化学/其他' })
  config_data: any;

  @Column({ default: true })
  is_latest: boolean;

  @Column({ default: false })
  is_shared: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ParameterHistory, (history) => history.group)
  history: ParameterHistory[];
}
