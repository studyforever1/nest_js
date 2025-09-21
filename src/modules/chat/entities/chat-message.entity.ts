import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  message_id: number;

  @Column({ type: 'text', nullable: false }) // 确保content列存在且非空
  content: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ManyToOne(() => User, (user) => user.sentMessages, { eager: true })
  sender: User;

  @ManyToOne(() => User, (user) => user.receivedMessages, { eager: true })
  receiver: User;
}
