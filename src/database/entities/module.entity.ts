// common/database/entities/module.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ConfigGroup } from './config-group.entity';
import { Task } from './task.entity';

@Entity('module')
export class Module {
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
}
