import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Task } from '../../../database/entities/task.entity';
import { User } from '../../user/entities/user.entity';

@Entity()
export class SharedData {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, task => task.task_uuid, { nullable: false })
  task: Task;

  @ManyToOne(() => User, user => user.user_id, { nullable: false })
  user: User; // 保存是谁共享的，可选显示

  @Column()
  scheme_id: string;

  @Column('json')
  result: any;

  @Column({ nullable: true })
  module_type: string;

  @CreateDateColumn()
  created_at: Date;
}
