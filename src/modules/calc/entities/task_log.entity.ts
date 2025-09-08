import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Task } from '../../../database/entities/task.entity';

@Entity('task_log')
export class TaskLog {
  @PrimaryGeneratedColumn()
  log_id: number;

  @ManyToOne(() => Task, (task) => task.logs)
  task: Task;
  
  @Column()
  status: string; // pending/running/finished/failed

  @Column({ nullable: true })
  message: string;

  @CreateDateColumn({ type: 'timestamp' })
  logged_at: Date;
}
