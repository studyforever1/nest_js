import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToMany,
} from 'typeorm';
import { Role } from '../../role/entities/role.entity';

@Entity('sys_menu')
export class Menu {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 0 })
  parentId: number;

  @Column()
  name: string;

  @Column()
  type: number; // 目录:2, 菜单:1, 按钮:4

  @Column({ nullable: true })
  routeName: string;

  @Column({ nullable: true })
  routePath: string;

  @Column({ nullable: true })
  component: string;

  @Column({ default: 1 })
  sort: number;

  @Column({ default: 1 })
  visible: number;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  redirect: string;

  /** 按钮权限标识，如果你要简化权限，这个字段可以用于前端按钮权限判断 */
  @Column({ nullable: true })
  perm: string;

  /** 角色拥有的菜单权限（多对多反向关系） */
  @ManyToMany(() => Role, (role) => role.menus)
  roles: Role[];

  /** 运行时使用 — 不落库 */
  children?: Menu[];
}
