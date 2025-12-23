import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Task } from '../../../database/entities/task.entity';

@Entity('system_latest_scheme')
@Index(['scheme_date', 'module_type'], { unique: true }) // 每天每模块唯一
export class SystemLatestScheme {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '方案日期 YYYY-MM-DD' })
  scheme_date: string;

  @Column({ comment: '模块类型' })
  module_type: string;

  @ManyToOne(() => Task, { nullable: true })
  task: Task;

  @Column({ comment: '方案ID taskUuid-方案序号' })
  scheme_id: string;

  @Column('json', { comment: '计算结果' })
  result: any;

  @ManyToOne(() => User, { nullable: false })
  modifier: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
