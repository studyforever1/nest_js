import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Role } from '../../role/entities/role.entity';

@Entity('permission')
export class Permission {
  @PrimaryGeneratedColumn()
  permission_id: number;

  /** 权限编码（唯一） */
  @Column({ unique: true })
  @Index()
  permissionCode: string;

  /** 权限名称（展示用） */
  @Column()
  permissionName: string;

  /** 权限描述（可选） */
  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  /** 权限 <-> 角色（多对多） */
  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
