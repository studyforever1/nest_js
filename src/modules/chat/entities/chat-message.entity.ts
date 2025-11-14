import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ChatRoom } from './chat-room.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
}

@Entity('chat_message')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  message_id: number;

  @ManyToOne(() => User, { nullable: false })
  sender: User;

  @ManyToOne(() => ChatRoom, { nullable: false })
  room: ChatRoom;

  @Column()
  content: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  message_type: MessageType;

  @Column('simple-array')
  read_by: number[] = [];

  @CreateDateColumn()
  created_at: Date;
}
