import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  OneToMany,
  DeleteDateColumn,
  ManyToMany,
  JoinTable
} from 'typeorm';
import { Task } from '../../../database/entities/task.entity';
import { Role } from '../../role/entities/role.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ unique: true })
  username: string;


  @Column({ nullable: true, select: false }) // 登录时手动 addSelect('user.password')
  password: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date;

  @OneToMany(() => Task, (task) => task.user)
  tasks: Task[];

  // 用户 <-> 角色（多对多）
  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'user_roles', 
    joinColumn: { name: 'user_id', referencedColumnName: 'user_id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'role_id' },
  })
  roles: Role[];
}
