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

  @Column({ unique: true })
  code: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  // 权限 <-> 角色（多对多）
  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
