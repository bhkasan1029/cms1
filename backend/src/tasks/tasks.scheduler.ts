import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TasksService } from './tasks.service';

@Injectable()
export class TasksScheduler {
  private readonly logger = new Logger(TasksScheduler.name);

  constructor(private readonly tasksService: TasksService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleFreeze() {
    const count = await this.tasksService.freezeOverdueTasks();
    if (count > 0) {
      this.logger.log(`Froze ${count} overdue task(s)`);
    }
  }
}
