import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;
}
