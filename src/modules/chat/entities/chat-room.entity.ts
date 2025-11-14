import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ChatMessage } from './chat-message.entity';

export enum RoomType {
  PRIVATE = 'private',
  GROUP = 'group',
}

@Entity('chat_room')
export class ChatRoom {
  @PrimaryGeneratedColumn()
  room_id: number;

  @Column({ unique: true })
  room_key: string;

  @Column({ type: 'enum', enum: RoomType })
  type: RoomType;

  @Column({ nullable: true })
  name: string;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'chat_room_members',
    joinColumn: { name: 'room_id', referencedColumnName: 'room_id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'user_id' },
  })
  members: User[];

  @OneToMany(() => ChatMessage, (msg) => msg.room)
  messages: ChatMessage[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
