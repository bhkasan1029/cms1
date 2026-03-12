import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });//This part sets up SMTP connection
  }

  private get fromAddress(): string {
    return `"CMS App" <${this.configService.get<string>('SMTP_USER')}>`;
  }

  async sendResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
//       Nodemailer opens a connection to SMTP_HOST
// It sends SMTP commands like:
// "hello"
// "email from X"
// "email to Y"
// "here is the message"
// The SMTP server sends the email
      from: this.fromAddress,
      to,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });
  }

  async sendTaskAssignedEmail(to: string, taskTitle: string, assignedByName: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'New Task Assigned to You',
      html: `
        <h2>Task Assigned</h2>
        <p>You have been assigned a new task: <strong>${taskTitle}</strong></p>
        <p>Assigned by: ${assignedByName}</p>
      `,
    });
  }

  async sendTaskReviewRequestEmail(to: string, taskTitle: string, assignedByName: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'New Task to Review',
      html: `
        <h2>Review Request</h2>
        <p>You have been assigned as reviewer for: <strong>${taskTitle}</strong></p>
        <p>Created by: ${assignedByName}</p>
      `,
    });
  }

  async sendTaskCompletedEmail(to: string, taskTitle: string, completedByName: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'Task Completed',
      html: `
        <h2>Task Completed</h2>
        <p>The task <strong>${taskTitle}</strong> has been marked as completed.</p>
        <p>Completed by: ${completedByName}</p>
      `,
    });
  }

  async sendTaskFrozenEmail(to: string, taskTitle: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'Task Frozen — Overdue',
      html: `
        <h2>Task Frozen</h2>
        <p>The task <strong>${taskTitle}</strong> has been automatically frozen because it is overdue.</p>
      `,
    });
  }

  async sendTaskUnfrozenEmail(to: string, taskTitle: string, unfrozenByName: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'Task Unfrozen',
      html: `
        <h2>Task Unfrozen</h2>
        <p>The task <strong>${taskTitle}</strong> has been unfrozen and is back in progress.</p>
        <p>Unfrozen by: ${unfrozenByName}</p>
      `,
    });
  }

  async sendRoleChangedEmail(to: string, firstName: string, newRole: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'Your Role Has Been Updated',
      html: `
        <h2>Role Updated</h2>
        <p>Hi ${firstName}, your role has been changed to <strong>${newRole}</strong>.</p>
      `,
    });
  }

  async sendAccountBlockedEmail(to: string, firstName: string, blocked: boolean): Promise<void> {
    const status = blocked ? 'blocked' : 'unblocked';
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: `Your Account Has Been ${blocked ? 'Blocked' : 'Unblocked'}`,
      html: `
        <h2>Account ${blocked ? 'Blocked' : 'Unblocked'}</h2>
        <p>Hi ${firstName}, your account has been ${status}.</p>
        ${blocked ? '<p>If you believe this is a mistake, please contact an administrator.</p>' : '<p>You can now log in again.</p>'}
      `,
    });
  }

  async sendAccountDeletionScheduledEmail(to: string, firstName: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'Your Account Is Scheduled for Deletion',
      html: `
        <h2>Account Deletion Scheduled</h2>
        <p>Hi ${firstName}, your account has been scheduled for deletion in 24 hours.</p>
        <p>If you believe this is a mistake, please contact an administrator immediately.</p>
      `,
    });
  }

  async sendAccountRestoredEmail(to: string, firstName: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'Your Account Has Been Restored',
      html: `
        <h2>Account Restored</h2>
        <p>Hi ${firstName}, your account has been restored. You can now log in again.</p>
      `,
    });
  }
}
