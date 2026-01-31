import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsInt, Min, MaxLength, IsBoolean, IsArray, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType, NotificationPriority } from '../entities/notification.entity';

// 创建通知
export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType, description: '通知类型' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationPriority, description: '优先级', required: false })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiProperty({ description: '通知标题', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: '通知内容', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  content: string;

  @ApiProperty({ description: '是否已读', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean) // ✅ 自动转换为 boolean
  read?: boolean;
}

// 列表查询通知
export class ListNotificationDto {
  @ApiProperty({ enum: NotificationType, description: '按类型筛选', required: false })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiProperty({ description: '按标题关键词搜索', required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @ApiProperty({ description: '最近多少天的通知', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number = 1;

  @ApiProperty({ description: '按已读状态筛选', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean) // ✅ 自动转换为 boolean
  read?: boolean;
}

// 删除通知
export class DeleteNotificationDto {
  @ApiProperty({ description: '通知 ID 数组' })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids: number[];
}

// 更新通知已读状态
export class UpdateNotificationReadDto {
  @ApiProperty({ description: '通知 ID' })
  @IsInt()
  id: number;

  @ApiProperty({ description: '是否已读' })
  @IsBoolean()
  @Type(() => Boolean) // ✅ 自动转换为 boolean
  read: boolean;
}

export class BatchUpdateNotificationReadDto {
  @ApiProperty({ description: '通知 ID 数组' })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids: number[];

  @ApiProperty({ description: '是否已读' })
  @IsBoolean()
  @Type(() => Boolean) // ✅ 自动转换为 boolean
  read: boolean;
}
