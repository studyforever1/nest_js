import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Task } from '../../../database/entities/task.entity';
import { Role } from '../../role/entities/role.entity';
import { ConfigGroup } from '../../../database/entities/config-group.entity';
import { ChatMessage } from '../../chat/entities/chat-message.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ unique: true })
  username: string;

  // 密码默认不查询，查询时需要 select: true
  @Column({ nullable: true, select: false })
  password: string;

  @Column({ nullable: true })
  email: string;

  /** 管理员姓名 */
  @Column({ nullable: true })
  fullName: string;

  /** 用户状态 */
  @Column({ default: true })
  is_active: boolean;

  /** 软删除标记 */
  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date;

  /** 任务列表 */
  @OneToMany(() => Task, (task) => task.user)
  tasks: Task[];

  /** 配置组列表 */
  @OneToMany(() => ConfigGroup, (group) => group.user)
  configGroups: ConfigGroup[];

  /** 用户角色 */
  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'user_id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'role_id' },
  })
  roles: Role[];

  /** 发送的聊天消息 */
  @OneToMany(() => ChatMessage, (msg) => msg.sender)
  sentMessages: ChatMessage[];
}
