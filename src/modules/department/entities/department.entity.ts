import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * 部门实体
 * 一个部门可以包含多个用户（一对多关系）
 */
@Entity('department')
export class Department {
  /** 部门ID（主键，自增） */
  @PrimaryGeneratedColumn()
  id: number;

  /** 部门名称（唯一，最大长度100） */
  @Column({ unique: true, length: 100 })
  name: string;

  /** 部门描述（可选，最大长度255） */
  @Column({ nullable: true, length: 255 })
  description?: string;

  /** 创建时间（自动生成） */
  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  /** 更新时间（自动更新） */
  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  /** 部门下的用户列表（一对多关系） */
  @OneToMany(() => User, (user) => user.department)
  users: User[];
}

