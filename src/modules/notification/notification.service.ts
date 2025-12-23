import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import dayjs from 'dayjs';
import { Notification, NotificationPriority } from './entities/notification.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { CreateNotificationDto, ListNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  /** 创建通知 */
  async create(dto: CreateNotificationDto, user: User) {
    const notification = this.repo.create({
      ...dto,
      priority: dto.priority || NotificationPriority.MEDIUM,
      creator: user,
    });
    const saved = await this.repo.save(notification);
    return ApiResponse.success(saved, '通知创建成功');
  }

  /** 分页获取通知，支持按类型/关键词/最近 N 天过滤 */
  async list(query: ListNotificationDto) {
    const { page = 1, pageSize = 10, type, keyword, days = 1 } = query;

    const startDate = dayjs().subtract(days - 1, 'day').startOf('day').toDate();

    const qb = this.repo.createQueryBuilder('n')
      .leftJoinAndSelect('n.creator', 'creator')
      .where('n.created_at >= :startDate', { startDate })
      .orderBy('n.priority', 'DESC')
      .addOrderBy('n.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (type) qb.andWhere('n.type = :type', { type });
    if (keyword) qb.andWhere('n.title LIKE :keyword', { keyword: `%${keyword}%` });

    const [records, total] = await qb.getManyAndCount();

    return ApiResponse.success({
      data: records.length ? records.map(r => ({
        id: r.id,
        type: r.type,
        priority: r.priority,
        title: r.title,
        content: r.content,
        creator: r.creator?.username || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })) : [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }, '获取通知列表成功');
  }

  /** 删除通知 */
  async delete(ids: number[]) {
    const result = await this.repo.delete({ id: In(ids) });
    return ApiResponse.success({ count: result.affected || 0 }, '通知删除成功');
  }
}
