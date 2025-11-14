import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChatRoom, RoomType } from './entities/chat-room.entity';
import { ChatMessage, MessageType } from './entities/chat-message.entity';
import { User } from '../user/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly roomRepo: Repository<ChatRoom>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** 创建私聊房间（如果已存在直接返回） */
async createPrivateRoom(userAId: number, userBId: number): Promise<ChatRoom> {
  if (userAId === userBId) throw new NotFoundException('不能和自己私聊');

  const [userA, userB] = await Promise.all([
    this.userRepo.findOne({ where: { user_id: userAId } }),
    this.userRepo.findOne({ where: { user_id: userBId } }),
  ]);

  if (!userA || !userB) throw new NotFoundException('用户不存在');

  // 🔹 SQL 直接查是否已有两人私聊房间
  const existingRoom = await this.roomRepo
    .createQueryBuilder('room')
    .leftJoinAndSelect('room.members', 'member')
    .where('room.type = :type', { type: RoomType.PRIVATE })
    .andWhere('member.user_id IN (:...ids)', { ids: [userAId, userBId] })
    .groupBy('room.room_id')
    .having('COUNT(member.user_id) = 2')
    .getOne();

  if (existingRoom) {
    existingRoom.name = existingRoom.members.find((m) => m.user_id !== userAId)?.username ?? '私聊';
    return existingRoom;
  }

  const newRoom = this.roomRepo.create({
    room_key: uuidv4(),
    type: RoomType.PRIVATE,
    members: [userA, userB],
    name: userB.username, // 创建时用对方用户名
  });

  return this.roomRepo.save(newRoom);
}


  /** 创建群聊房间 */
  async createGroup(
    creatorId: number,
    name: string,
    memberIds: number[],
  ): Promise<ChatRoom> {
    const allIds = Array.from(new Set([creatorId, ...memberIds]));
    const members = await this.userRepo.find({ where: { user_id: In(allIds) } });
    if (members.length === 0) throw new NotFoundException('用户不存在');

    const newRoom = this.roomRepo.create({
      room_key: uuidv4(),
      type: RoomType.GROUP,
      name,
      members,
    });
    return this.roomRepo.save(newRoom);
  }

  /** 给群聊添加成员 */
  async addUserToGroup(roomId: number, userId: number): Promise<ChatRoom> {
    const room = await this.roomRepo.findOne({
      where: { room_id: roomId },
      relations: ['members'],
    });
    const user = await this.userRepo.findOne({ where: { user_id: userId } });

    if (!room) throw new NotFoundException('房间不存在');
    if (!user) throw new NotFoundException('用户不存在');

    if (!room.members.some((m) => m.user_id === userId)) {
      room.members.push(user);
      return this.roomRepo.save(room);
    }
    return room;
  }

  /** 从群聊移除成员 */
  async removeUserFromGroup(roomId: number, userId: number): Promise<ChatRoom> {
    const room = await this.roomRepo.findOne({
      where: { room_id: roomId },
      relations: ['members'],
    });
    if (!room) throw new NotFoundException('房间不存在');

    room.members = room.members.filter((m) => m.user_id !== userId);
    return this.roomRepo.save(room);
  }

 /** 查询某用户所有房间 */
async findUserRooms(userId: number) {
  // 一次性加载房间和所有成员
  const rooms = await this.roomRepo
    .createQueryBuilder('room')
    .leftJoinAndSelect('room.members', 'member')
    .leftJoin('room.members', 'current', 'current.user_id = :userId', { userId }) // 仅确保用户参与过房间
    .where('current.user_id IS NOT NULL') // 当前用户在该房间
    .getMany();

  return rooms.map((room) => {
    const members = room.members;

    // 私聊房间显示对方名字
    let displayName = room.name;
    if (room.type === RoomType.PRIVATE) {
      const otherUser = members.find((m) => m.user_id !== userId);
      displayName = otherUser?.username ?? '私聊';
    }

    return {
      room_id: room.room_id,
      room_key: room.room_key,
      type: room.type,
      name: displayName,
      members,
      created_at: room.created_at,
      updated_at: room.updated_at,
    };
  });
}




  /** 根据 room_key 查询房间及成员 */
async getRoomMembersByKey(roomKey: string): Promise<User[]> {
  const room = await this.roomRepo.findOne({
    where: { room_key: roomKey },
    relations: ['members'],
  });
  if (!room) throw new NotFoundException('房间不存在');
  return room.members;
}

/** 发送消息（通过 room_key） */
async sendMessageByKey(senderId: number, roomKey: string, content: string) {
  const sender = await this.userRepo.findOne({ where: { user_id: senderId } });
  const room = await this.roomRepo.findOne({ where: { room_key: roomKey } });
  if (!sender || !room) throw new NotFoundException('发送消息失败');

  const msg = this.messageRepo.create({
    sender,
    room,
    content,
    message_type: MessageType.TEXT,
    read_by: [senderId],
  });

  return this.messageRepo.save(msg);
}

/** 获取房间消息历史（通过 room_key） */
async getHistoryByKey(roomKey: string): Promise<ChatMessage[]> {
  const room = await this.roomRepo.findOne({ where: { room_key: roomKey } });
  if (!room) throw new NotFoundException('房间不存在');

  return this.messageRepo.find({
    where: { room: { room_id: room.room_id } },
    relations: ['sender', 'room'],
    order: { created_at: 'ASC' },
  });
}

}
