import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Result } from './result.entity';
import { TaskLog } from './task_log.entity';

@Entity()
export class Task {
  @PrimaryGeneratedColumn()
  task_id: number;

  @Column({ unique: true })
  task_uuid: string;

  @Column()
  module_type: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'running' | 'finished' | 'failed';

  @ManyToOne(() => User, user => user.tasks)
  user: User;

  @OneToMany(() => Result, result => result.task)
  results: Result[];

  @OneToMany(() => TaskLog, log => log.task)  // 新增
  logs: TaskLog[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
