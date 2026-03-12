import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_REVIEW_REQUEST = 'TASK_REVIEW_REQUEST',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FROZEN = 'TASK_FROZEN',
  TASK_UNFROZEN = 'TASK_UNFROZEN',
  ROLE_CHANGED = 'ROLE_CHANGED',
  ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED',
  ACCOUNT_UNBLOCKED = 'ACCOUNT_UNBLOCKED',
  DELETION_SCHEDULED = 'DELETION_SCHEDULED',
  ACCOUNT_RESTORED = 'ACCOUNT_RESTORED',
}

export enum NotificationCategory {
  ACTIVITY = 'activity',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: NotificationType;

  @Column({ type: 'varchar' })
  category: NotificationCategory;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  taskId: string;

  @Column({ type: 'uuid', nullable: true })
  actorId: string;

  @CreateDateColumn()
  createdAt: Date;
}
