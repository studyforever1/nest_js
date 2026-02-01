import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import dayjs from 'dayjs';

import { Notification, NotificationPriority } from './entities/notification.entity';
import { NotificationUser } from './entities/notification-user.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { CreateNotificationDto, ListNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(NotificationUser)
    private readonly notificationUserRepo: Repository<NotificationUser>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** 创建通知并分发给用户（默认全员） */
  async create(dto: CreateNotificationDto, creator: User, users?: User[]) {
    const notification = this.notificationRepo.create({
      type: dto.type,
      title: dto.title,
      content: dto.content,
      priority: dto.priority || NotificationPriority.MEDIUM,
      creator,
    });

    const savedNotification = await this.notificationRepo.save(notification);

    let targetUsers = users;
    if (!targetUsers || targetUsers.length === 0) {
      targetUsers = await this.userRepo.find({
        select: ['user_id'],
      });
    }

    const userStatusList = targetUsers.map(u =>
      this.notificationUserRepo.create({
        notification: savedNotification,
        user: { user_id: u.user_id } as User,
        read: false,
      }),
    );

    await this.notificationUserRepo.save(userStatusList);

    return ApiResponse.success(savedNotification, '通知创建成功');
  }

  /** 当前用户通知列表 */
  async list(query: ListNotificationDto, currentUser: User) {
    const {
      page = 1,
      pageSize = 10,
      type,
      keyword,
      days = 1,
      read, // ✅ 关键：读取 read
    } = query;

    const startDate = dayjs()
      .subtract(days - 1, 'day')
      .startOf('day')
      .toDate();

    const qb = this.notificationUserRepo
      .createQueryBuilder('nu')
      .leftJoinAndSelect('nu.notification', 'n')
      .leftJoinAndSelect('n.creator', 'creator')
      .where('nu.user_id = :userId', { userId: currentUser.user_id })
      .andWhere('n.created_at >= :startDate', { startDate });

    if (type) {
      qb.andWhere('n.type = :type', { type });
    }

    if (keyword) {
      qb.andWhere('n.title LIKE :keyword', { keyword: `%${keyword}%` });
    }

    // ✅ 已读 / 未读筛选
    if (read !== undefined) {
      qb.andWhere('nu.read = :read', { read });
    }

    qb.orderBy('nu.read', 'ASC')
      .addOrderBy('n.priority', 'DESC')
      .addOrderBy('n.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [records, total] = await qb.getManyAndCount();

    // ✅ 未读数量（不受 read 查询参数影响）
    const unreadCount = await this.notificationUserRepo.count({
      where: {
        user: { user_id: currentUser.user_id },
        read: false,
        notification: {
          created_at: MoreThanOrEqual(startDate),
          ...(type ? { type } : {}),
        },
      },
    });

    return ApiResponse.success(
      {
        data: records.map(r => ({
          id: r.notification.id,
          type: r.notification.type,
          priority: r.notification.priority,
          title: r.notification.title,
          content: r.notification.content,
          read: r.read,
          creator: r.notification.creator?.username || null,
          created_at: r.notification.created_at,
          updated_at: r.notification.updated_at,
        })),
        total,
        unreadCount,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      '获取通知列表成功',
    );
  }

  /** 更新单条通知已读状态 */
  async updateReadStatus(user: User, notificationId: number, read: boolean) {
    const record = await this.notificationUserRepo.findOne({
      where: {
        user: { user_id: user.user_id },
        notification: { id: notificationId },
      },
    });

    if (!record) {
      return ApiResponse.error('通知不存在');
    }

    record.read = read;
    await this.notificationUserRepo.save(record);

    return ApiResponse.success(record, '通知状态更新成功');
  }

  /** 批量更新通知已读状态 */
  async batchUpdateReadStatus(user: User, ids: number[], read: boolean) {
    const result = await this.notificationUserRepo
      .createQueryBuilder()
      .update(NotificationUser)
      .set({ read })
      .where('user_id = :userId', { userId: user.user_id })
      .andWhere('notification_id IN (:...ids)', { ids })
      .execute();

    return ApiResponse.success(
      { updated: result.affected || 0 },
      '批量更新通知已读状态成功',
    );
  }
}
