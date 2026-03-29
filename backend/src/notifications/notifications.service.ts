import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
  NotificationCategory,
} from './notification.entity';

export interface CreateNotificationDto {
  type: NotificationType;
  title: string;
  message: string;
  userId: string;
  taskId?: string;
  actorId?: string;
}

const ACTIVITY_TYPES: NotificationType[] = [
  NotificationType.TASK_ASSIGNED,
  NotificationType.TASK_REVIEW_REQUEST,
  NotificationType.TASK_COMPLETED,
  NotificationType.TASK_FROZEN,
  NotificationType.TASK_UNFROZEN,
];

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async createAndSend(dto: CreateNotificationDto): Promise<Notification> {
    const category = ACTIVITY_TYPES.includes(dto.type)
      ? NotificationCategory.ACTIVITY
      : NotificationCategory.SYSTEM;

    const notification = this.repo.create({ ...dto, category });
    return this.repo.save(notification);
  }

  async findByUser(
    userId: string,
    options?: { category?: string; limit?: number; offset?: number },
  ): Promise<{ notifications: Notification[]; total: number }> {
    const where: Record<string, any> = { userId };
    if (options?.category) {
      where.category = options.category;
    }

    const [notifications, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });

    return { notifications, total };
  }

  async countUnread(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, isRead: false } });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.repo.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repo.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }
}
