import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private chatRepo: Repository<ChatMessage>,
  ) {}

  /** 发送消息 */
  async sendMessage(sender: User, receiver: User, content: string) {
    try {
      this.logger.log(
        `发送消息: senderId=${sender.user_id}, receiverId=${receiver.user_id}, content="${content}"`,
      );

      const msg = this.chatRepo.create({ sender, receiver, content });

      this.logger.log(`创建消息实体: ${JSON.stringify(msg)}`);

      const saved = await this.chatRepo.save(msg);

      this.logger.log(`保存成功: ${JSON.stringify(saved)}`);
      return saved;
    } catch (error) {
      this.logger.error('发送消息失败', error);
      throw error; // 保留原始错误，Nest 会返回 500
    }
  }

  /** 获取两个用户之间的对话 */
  async getConversation(userId1: number, userId2: number) {
    try {
      this.logger.log(`获取对话: userId1=${userId1}, userId2=${userId2}`);

      const messages = await this.chatRepo.find({
        where: [
          { sender: { user_id: userId1 }, receiver: { user_id: userId2 } },
          { sender: { user_id: userId2 }, receiver: { user_id: userId1 } },
        ],
        order: { created_at: 'ASC' },
        relations: ['sender', 'receiver'], // 确保加载关联实体
      });

      this.logger.log(`查询结果数量: ${messages.length}`);
      return messages;
    } catch (error) {
      this.logger.error('获取对话失败', error);
      throw error;
    }
  }
}
