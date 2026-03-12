import { IsString, IsIn } from 'class-validator';

export class UpdateRoleDto {
  @IsString()
  @IsIn(['admin', 'reviewer', 'user'])
  role: string;
}
