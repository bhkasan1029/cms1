import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Task, TaskStatus } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) { }

  async create(dto: CreateTaskDto, assignedById: string): Promise<Task> {

    const assignedTo = await this.usersService.findById(dto.assignedToId);
    if (!assignedTo) {
      throw new NotFoundException('Assigned user not found');
    }

    const reviewer = await this.usersService.findById(dto.reviewerId);
    if (!reviewer) {
      throw new NotFoundException('Reviewer not found');
    }

    const task = this.tasksRepository.create({
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      dueDate: new Date(dto.dueDate),
      assignedToId: dto.assignedToId,
      assignedById,
      reviewerId: dto.reviewerId,
      status: TaskStatus.IN_PROGRESS,
      finished: false,
    });

    //log the task creation details
    this.logger.log(`Creating task: ${task.title} assigned to user ID ${task.assignedToId} by user ID ${assignedById} with reviewer ID ${task.reviewerId}`);

    const savedTask = await this.tasksRepository.save(task);

    const assignedBy = await this.usersService.findById(assignedById);
    const assignedByName = assignedBy ? `${assignedBy.firstName} ${assignedBy.lastName}` : 'Unknown';

    if (assignedTo.emailNotificationsEnabled) {
      this.mailService.sendTaskAssignedEmail(assignedTo.email, savedTask.title, assignedByName)
        .catch(err => this.logger.error(`Failed to send task assigned email to ${assignedTo.email}`, err.stack));
    }

    this.notificationsService.createAndSend({
      type: NotificationType.TASK_ASSIGNED,
      title: 'Task Assigned',
      message: `${assignedByName} assigned you the task "${savedTask.title}"`,
      userId: assignedTo.id,
      taskId: savedTask.id,
      actorId: assignedById,
    }).catch(err => this.logger.error('Failed to send task assigned notification', err.stack));

    if (reviewer.id !== assignedTo.id && reviewer.emailNotificationsEnabled) {
      this.mailService.sendTaskReviewRequestEmail(reviewer.email, savedTask.title, assignedByName)
        .catch(err => this.logger.error(`Failed to send task review request email to ${reviewer.email}`, err.stack));
    }

    if (reviewer.id !== assignedTo.id) {
      this.notificationsService.createAndSend({
        type: NotificationType.TASK_REVIEW_REQUEST,
        title: 'Review Requested',
        message: `${assignedByName} requested your review on "${savedTask.title}"`,
        userId: reviewer.id,
        taskId: savedTask.id,
        actorId: assignedById,
      }).catch(err => this.logger.error('Failed to send review request notification', err.stack));
    }

    return savedTask;
  }

  async findAll(userId: string, role: string): Promise<Task[]> {
    if (role === 'admin' || role === 'reviewer') {
      return this.tasksRepository.find({
        order: { createdAt: 'DESC' },
      });
    }
    return this.tasksRepository.find({
      where: { assignedToId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async updateStatus(id: string, userId: string, status: TaskStatus): Promise<Task> {
    const task = await this.findOne(id);

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('Only the assigned user can update task status');
    }

    if (task.status === TaskStatus.FROZEN) {
      throw new ForbiddenException('Cannot update a frozen task');
    }

    if (status !== TaskStatus.COMPLETED) {
      throw new BadRequestException('You can only mark tasks as completed');
    }

    task.status = TaskStatus.COMPLETED;
    task.finished = true;

    const savedTask = await this.tasksRepository.save(task);

    const completedBy = await this.usersService.findById(userId);
    const completedByName = completedBy ? `${completedBy.firstName} ${completedBy.lastName}` : 'Unknown';

    const creator = await this.usersService.findById(task.assignedById);
    if (creator && creator.emailNotificationsEnabled) {
      this.mailService.sendTaskCompletedEmail(creator.email, savedTask.title, completedByName)
        .catch(err => this.logger.error(`Failed to send task completed email to ${creator.email}`, err.stack));
    }

    if (creator) {
      this.notificationsService.createAndSend({
        type: NotificationType.TASK_COMPLETED,
        title: 'Task Completed',
        message: `${completedByName} completed the task "${savedTask.title}"`,
        userId: creator.id,
        taskId: savedTask.id,
        actorId: userId,
      }).catch(err => this.logger.error('Failed to send task completed notification', err.stack));
    }

    const reviewer = await this.usersService.findById(task.reviewerId);
    if (reviewer && reviewer.id !== creator?.id && reviewer.emailNotificationsEnabled) {
      this.mailService.sendTaskCompletedEmail(reviewer.email, savedTask.title, completedByName)
        .catch(err => this.logger.error(`Failed to send task completed email to ${reviewer.email}`, err.stack));
    }

    if (reviewer && reviewer.id !== creator?.id) {
      this.notificationsService.createAndSend({
        type: NotificationType.TASK_COMPLETED,
        title: 'Task Completed',
        message: `${completedByName} completed the task "${savedTask.title}"`,
        userId: reviewer.id,
        taskId: savedTask.id,
        actorId: userId,
      }).catch(err => this.logger.error('Failed to send task completed notification', err.stack));
    }

    return savedTask;
  }

  async unfreeze(id: string, userId: string): Promise<Task> {
    const task = await this.findOne(id);

    if (task.status !== TaskStatus.FROZEN) {
      throw new BadRequestException('Task is not frozen');
    }

    if (task.assignedById !== userId) {
      throw new ForbiddenException('Only the task creator can unfreeze this task');
    }

    task.status = TaskStatus.IN_PROGRESS;

    const savedTask = await this.tasksRepository.save(task);

    const unfrozenBy = await this.usersService.findById(userId);
    const unfrozenByName = unfrozenBy ? `${unfrozenBy.firstName} ${unfrozenBy.lastName}` : 'Unknown';

    const assignedUser = await this.usersService.findById(task.assignedToId);
    if (assignedUser && assignedUser.emailNotificationsEnabled) {
      this.mailService.sendTaskUnfrozenEmail(assignedUser.email, savedTask.title, unfrozenByName)
        .catch(err => this.logger.error(`Failed to send task unfrozen email to ${assignedUser.email}`, err.stack));
    }

    if (assignedUser) {
      this.notificationsService.createAndSend({
        type: NotificationType.TASK_UNFROZEN,
        title: 'Task Unfrozen',
        message: `${unfrozenByName} unfroze your task "${savedTask.title}"`,
        userId: assignedUser.id,
        taskId: savedTask.id,
        actorId: userId,
      }).catch(err => this.logger.error('Failed to send task unfrozen notification', err.stack));
    }

    return savedTask;
  }

  async delete(id: string): Promise<void> {
    const task = await this.findOne(id);
    await this.tasksRepository.remove(task);
  }

  async freezeOverdueTasks(): Promise<number> {
    const now = new Date();
    const overdue = await this.tasksRepository.find({
      where: {
        status: TaskStatus.IN_PROGRESS,
        dueDate: LessThan(now),
      },
    });

    if (overdue.length === 0) return 0;

    for (const task of overdue) {
      task.status = TaskStatus.FROZEN;
    }

    await this.tasksRepository.save(overdue);

    for (const task of overdue) {
      const assignedUser = await this.usersService.findById(task.assignedToId);
      if (assignedUser && assignedUser.emailNotificationsEnabled) {
        this.mailService.sendTaskFrozenEmail(assignedUser.email, task.title)
          .catch(err => this.logger.error(`Failed to send task frozen email to ${assignedUser.email}`, err.stack));
      }

      if (assignedUser) {
        this.notificationsService.createAndSend({
          type: NotificationType.TASK_FROZEN,
          title: 'Task Frozen',
          message: `Your task "${task.title}" has been frozen due to being overdue`,
          userId: assignedUser.id,
          taskId: task.id,
        }).catch(err => this.logger.error('Failed to send task frozen notification', err.stack));
      }

      const creator = await this.usersService.findById(task.assignedById);
      if (creator && creator.id !== assignedUser?.id && creator.emailNotificationsEnabled) {
        this.mailService.sendTaskFrozenEmail(creator.email, task.title)
          .catch(err => this.logger.error(`Failed to send task frozen email to ${creator.email}`, err.stack));
      }

      if (creator && creator.id !== assignedUser?.id) {
        this.notificationsService.createAndSend({
          type: NotificationType.TASK_FROZEN,
          title: 'Task Frozen',
          message: `The task "${task.title}" has been frozen due to being overdue`,
          userId: creator.id,
          taskId: task.id,
        }).catch(err => this.logger.error('Failed to send task frozen notification', err.stack));
      }
    }

    return overdue.length;
  }
}
