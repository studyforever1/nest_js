import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Task } from './task.entity';

@Entity()
export class TaskLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  message: string;

  @ManyToOne(() => Task, task => task.logs, { onDelete: 'CASCADE' })
  task: Task;
}
