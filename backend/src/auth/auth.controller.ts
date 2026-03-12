import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Patch,
  Delete,
  Param,
  Request,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateBioDto } from './dto/update-bio.dto';
import { UpdateNameDto } from './dto/update-name.dto';
import { AdminActionDto } from './dto/admin-action.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateEmailNotificationsDto } from './dto/update-email-notifications.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { HobbyDTO } from './dto/hobby.dto';
import { UsersService } from 'src/users/users.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) { }

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    return this.authService.login(user);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('get')
  async getHobby(@Body() inputObject: HobbyDTO) {
    const hobby = await this.usersService.findUserHobbyByUsername(inputObject.username);
    return hobby;
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('account')
  async getAccount(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, resetToken, resetTokenExpiry, refreshToken, ...rest } = user;
    return rest;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('account/password')
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('account/bio')
  async updateBio(@Request() req: any, @Body() dto: UpdateBioDto) {
    const user = await this.usersService.updateBio(req.user.userId, dto.bio);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, resetToken, resetTokenExpiry, refreshToken, ...rest } = user;
    return rest;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('account/name')
  async updateName(@Request() req: any, @Body() dto: UpdateNameDto) {
    const user = await this.usersService.updateName(req.user.userId, dto.firstName, dto.lastName);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, resetToken, resetTokenExpiry, refreshToken, ...rest } = user;
    return rest;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'reviewer')
  @Get('users')
  async getAllUsers() {
    const users = await this.usersService.findAll();
    return users.map(({ password, resetToken, resetTokenExpiry, refreshToken, ...rest }) => rest);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'reviewer')
  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Request() req: any,
  ) {
    // Reviewers can only assign 'user' or 'reviewer'
    if (req.user.role === 'reviewer' && updateRoleDto.role === 'admin') {
      throw new ForbiddenException('Reviewers cannot assign admin role');
    }
    const user = await this.usersService.updateRole(id, updateRoleDto.role);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailNotificationsEnabled) {
      this.mailService.sendRoleChangedEmail(user.email, user.firstName, updateRoleDto.role)
        .catch(err => this.logger.error(`Failed to send role changed email to ${user.email}`, err.stack));
    }

    this.notificationsService.createAndSend({
      type: NotificationType.ROLE_CHANGED,
      title: 'Role Changed',
      message: `Your role has been updated to ${updateRoleDto.role}`,
      userId: id,
      actorId: req.user.userId,
    }).catch(err => this.logger.error('Failed to send role changed notification', err.stack));

    const { password, resetToken, resetTokenExpiry, ...rest } = user;
    return rest;
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, resetToken, resetTokenExpiry, refreshToken, ...rest } = user;
    return rest;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('users/:id/block')
  async blockUser(
    @Param('id') id: string,
    @Body() dto: AdminActionDto,
    @Request() req: any,
  ) {
    if (id === req.user.userId) {
      throw new ForbiddenException('Cannot block your own account');
    }
    const valid = await this.authService.verifyPassword(req.user.userId, dto.password);
    if (!valid) {
      throw new ForbiddenException('Incorrect password');
    }
    const target = await this.usersService.findById(id);
    if (!target) {
      throw new NotFoundException('User not found');
    }
    const blocked = !target.isBlocked;
    const user = await this.usersService.blockUser(id, blocked);

    if (user && user.emailNotificationsEnabled) {
      this.mailService.sendAccountBlockedEmail(user.email, user.firstName, blocked)
        .catch(err => this.logger.error(`Failed to send account blocked email to ${user.email}`, err.stack));
    }

    this.notificationsService.createAndSend({
      type: blocked ? NotificationType.ACCOUNT_BLOCKED : NotificationType.ACCOUNT_UNBLOCKED,
      title: blocked ? 'Account Blocked' : 'Account Unblocked',
      message: blocked
        ? 'Your account has been blocked by an administrator'
        : 'Your account has been unblocked by an administrator',
      userId: id,
      actorId: req.user.userId,
    }).catch(err => this.logger.error('Failed to send account block notification', err.stack));

    const { password, resetToken, resetTokenExpiry, refreshToken, ...rest } = user!;
    return rest;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('users/:id/soft-delete')
  async softDeleteUser(
    @Param('id') id: string,
    @Body() dto: AdminActionDto,
    @Request() req: any,
  ) {
    if (id === req.user.userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }
    const valid = await this.authService.verifyPassword(req.user.userId, dto.password);
    if (!valid) {
      throw new ForbiddenException('Incorrect password');
    }
    const target = await this.usersService.findById(id);
    if (!target) {
      throw new NotFoundException('User not found');
    }
    await this.usersService.softDeleteUser(id);

    if (target.emailNotificationsEnabled) {
      this.mailService.sendAccountDeletionScheduledEmail(target.email, target.firstName)
        .catch(err => this.logger.error(`Failed to send account deletion email to ${target.email}`, err.stack));
    }

    this.notificationsService.createAndSend({
      type: NotificationType.DELETION_SCHEDULED,
      title: 'Account Deletion Scheduled',
      message: 'Your account has been scheduled for deletion in 24 hours',
      userId: id,
      actorId: req.user.userId,
    }).catch(err => this.logger.error('Failed to send deletion scheduled notification', err.stack));

    return { message: 'Account scheduled for deletion in 24 hours' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('users/:id/restore')
  async restoreUser(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const target = await this.usersService.findById(id);
    if (!target) {
      throw new NotFoundException('User not found');
    }
    if (!target.deletedAt) {
      throw new ForbiddenException('Account is not scheduled for deletion');
    }
    const user = await this.usersService.restoreUser(id);

    if (user && user.emailNotificationsEnabled) {
      this.mailService.sendAccountRestoredEmail(user.email, user.firstName)
        .catch(err => this.logger.error(`Failed to send account restored email to ${user.email}`, err.stack));
    }

    this.notificationsService.createAndSend({
      type: NotificationType.ACCOUNT_RESTORED,
      title: 'Account Restored',
      message: 'Your account has been restored by an administrator',
      userId: id,
      actorId: req.user.userId,
    }).catch(err => this.logger.error('Failed to send account restored notification', err.stack));

    const { password, resetToken, resetTokenExpiry, refreshToken, ...rest } = user!;
    return rest;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('account/email-notifications')
  async updateEmailNotifications(@Request() req: any, @Body() dto: UpdateEmailNotificationsDto) {
    const user = await this.usersService.updateEmailNotificationsEnabled(req.user.userId, dto.enabled);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, resetToken, resetTokenExpiry, refreshToken, ...rest } = user;
    return rest;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string, @Request() req: any) {
    if (id === req.user.userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }
}
