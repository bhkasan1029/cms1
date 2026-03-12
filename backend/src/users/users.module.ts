import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Hobbies } from './hobby.entity';
import { UsersService } from './users.service';
import { CleanupTask } from './cleanup.task';

@Module({
  imports: [TypeOrmModule.forFeature([User, Hobbies])],
  providers: [UsersService, CleanupTask],
  exports: [UsersService],
})
export class UsersModule {}
