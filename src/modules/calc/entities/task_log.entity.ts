import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { CalcTask } from '../../../database/entities/task.entity';

@Entity('task_log')
export class TaskLog {
  @PrimaryGeneratedColumn()
  log_id: number;

  @ManyToOne(() => CalcTask, (task) => task.logs)
  task: CalcTask;
  
  @Column()
  status: string; // pending/running/finished/failed

  @Column({ nullable: true })
  message: string;

  @CreateDateColumn({ type: 'timestamp' })
  logged_at: Date;
}
