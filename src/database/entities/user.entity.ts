import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Task } from './task.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @OneToMany(() => Task, task => task.user)
  tasks: Task[];
}
