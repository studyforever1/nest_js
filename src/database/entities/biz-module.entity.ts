import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ConfigGroup } from './config-group.entity';
import { Task } from './task.entity';

@Entity('biz_module')
export class BizModule {
  @PrimaryGeneratedColumn()
  module_id: number;

  @Column({ comment: '模块名称' })
  name: string;

  @Column({ nullable: true, comment: '模块描述' })
  description: string;

  @OneToMany(() => ConfigGroup, (group) => group.module)
  configGroups: ConfigGroup[];

  @OneToMany(() => Task, (task) => task.module)
  tasks: Task[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
