// src/modules/role/entities/role.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinTable,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Menu } from '../../menu/entity/menu.entity';

@Entity('role')
export class Role {
  @PrimaryGeneratedColumn()
  role_id: number;

  @Column({ unique: true })
  roleCode: string;

  @Column()
  roleName: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  /** 角色关联菜单（含目录/菜单/按钮） */
  @ManyToMany(() => Menu, (menu) => menu.roles, { cascade: true })
  @JoinTable({
    name: 'role_menu',
    joinColumn: { name: 'role_id', referencedColumnName: 'role_id' },
    inverseJoinColumn: {
      name: 'menu_id',
      referencedColumnName: 'id',
    },
  })
  menus: Menu[];
}
