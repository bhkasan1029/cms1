import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from './users.service';

@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  constructor(private readonly usersService: UsersService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup() {
    const count = await this.usersService.permanentlyDeleteExpired();
    if (count > 0) {
      this.logger.log(`Permanently deleted ${count} expired account(s)`);
    }
  }
}
