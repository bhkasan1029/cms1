import { IsString, IsNotEmpty, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { TaskPriority } from '../task.entity';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(TaskPriority)
  priority: TaskPriority;

  @IsDateString()
  dueDate: string;

  @IsUUID()
  assignedToId: string;

  @IsUUID()
  reviewerId: string;
}
