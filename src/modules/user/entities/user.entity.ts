import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToMany,
  ManyToOne,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { Department } from '../../department/entities/department.entity';
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

  @Column({ nullable: true, select: false })
  password: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true })
  avatarPath: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date;

  /** ✅ 所属部门（关键新增） */
  @ManyToOne(() => Department, (dept) => dept.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;

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
