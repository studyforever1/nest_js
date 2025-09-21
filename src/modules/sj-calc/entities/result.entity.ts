import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Task } from '../../../database/entities/task.entity';

@Entity('result')
export class Result {
  @PrimaryGeneratedColumn()
  result_id: number;

  @ManyToOne(() => Task, (task) => task.results, { onDelete: 'CASCADE' })
  task: Task;

  @Column({ type: 'json', nullable: true })
  output_data: any; // 存储计算结果 JSON

  @Column({ default: false })
  is_shared: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  finished_at?: Date;
}
