import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum NotificationType {
  SYSTEM = '消息通知',
  QUALITY_ALERT = '质量和指标预警',
  ROBOT_ALERT = '小慧机器人异常预警',
  COST_DAILY = '成本日报',
  QUALITY_DAILY = '质量日报',
}

export enum NotificationPriority {
  LOW = '低',
  MEDIUM = '中',
  HIGH = '高',
}

@Entity('notifications')
@Index(['created_at'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationPriority, default: NotificationPriority.MEDIUM })
  priority: NotificationPriority;

  @Column({ comment: '通知标题' })
  title: string;

  @Column('text', { comment: '通知内容' })
  content: string;

  @ManyToOne(() => User, { nullable: false })
  creator: User; // 发布者

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
