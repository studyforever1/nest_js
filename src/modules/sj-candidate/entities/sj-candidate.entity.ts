import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Task } from '../../../database/entities/task.entity';
import { User } from '../../user/entities/user.entity';

@Entity('sj_candidate')
export class SjCandidate {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  task: Task;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'varchar', length: 64 })
  scheme_id: string;

  @Column({ type: 'json' })
  result: any;

  @Column({ type: 'varchar', length: 64 })
  module_type: string;

  @CreateDateColumn()
  created_at: Date;
}
