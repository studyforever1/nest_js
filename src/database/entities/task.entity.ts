import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { Result } from '../../modules/sj-calc/entities/result.entity';
import { TaskLog } from '../../modules/sj-calc/entities/task_log.entity';
import { BizModule } from '../entities/biz-module.entity';
import { ConfigGroup } from '../entities/config-group.entity';

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  FINISHED = 'finished',
  FAILED = 'failed',
  STOPPED = 'stopped',
}

@Entity('task')
export class Task {
  @PrimaryGeneratedColumn()
  task_id: number;

  @Column({ unique: true })
  task_uuid: string;

  @Column()
  module_type: string; // 模块类型，比如 "烧结_区间品位配料"

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  /** 任务所属用户 */
  @ManyToOne(() => User, (user) => user.tasks, { eager: false })
  user: User;

  /** 任务所属模块（关联 biz_module 表） */
  @ManyToOne(() => BizModule, (module) => module.tasks, { eager: false })
  module: BizModule;

  /** 使用的参数组 */
  @ManyToOne(() => ConfigGroup, (group) => group.tasks, {
    eager: false,
    nullable: true,
  })
  configGroup: ConfigGroup;

  @OneToMany(() => Result, (result) => result.task, { cascade: true })
  results: Result[];

  @OneToMany(() => TaskLog, (log) => log.task, { cascade: true })
  logs: TaskLog[];

  @Column({ type: 'json', nullable: true })
  parameters: Record<string, any>; // 存储原始输入参数(JSON)

  // ---------------- 新增字段 ----------------
  @Column({ type: 'int', default: 0 })
  progress: number; // 当前任务进度

  @Column({ type: 'int', default: 100 })
  total: number; // 总进度量

  @Column({ type: 'timestamp', nullable: true })
  finished_at?: Date; // 任务完成时间
  // -----------------------------------------

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at?: Date; // 软删除
}
