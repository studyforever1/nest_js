import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sys_menu')
export class Menu {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 0 })
  parentId: number;

  @Column()
  name: string;

  @Column()
  type: number; // 目录：2，菜单：1，按钮：4

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

  @Column({ nullable: true })
  perm: string;
}
