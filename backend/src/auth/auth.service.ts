import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from 'src/users/user.entity';
import { UsersService } from 'src/users/users.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private readonly HARDCODED_ADMIN_EMAIL = 'bhkasan1029@gmail.com';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) { }

  async validateUser(usernameOrEmail: string, password: string): Promise<User> {
    const trimmed = usernameOrEmail.trim();
    const user =
      (await this.usersService.findByUsername(trimmed)) ??
      (await this.usersService.findByEmail(trimmed));

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.isBlocked) {
      throw new ForbiddenException('Your account has been blocked');
    }
    if (user.deletedAt) {
      throw new ForbiddenException('Your account has been scheduled for deletion');
    }
    return user;
  }

  async login(user: User): Promise<{ access_token: string; refresh_token: string }> {
    // Ensure hardcoded admin always has admin role
    if (user.email === this.HARDCODED_ADMIN_EMAIL && user.role !== 'admin') {
      await this.usersService.updateRole(user.id, 'admin');
      user.role = 'admin';
    }

    const tokens = await this.generateTokens(user);

    // Hash and store refresh token in DB
    const hashedRefresh = await bcrypt.hash(tokens.refresh_token, 10);
    await this.usersService.saveRefreshToken(user.id, hashedRefresh);

    return tokens;
  }

  async refreshTokens(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    // Verify the refresh token JWT
    let payload: { sub: string; username: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Find the user and check the stored hash matches
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (user.isBlocked || user.deletedAt) {
      throw new UnauthorizedException('Account is no longer active');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Token rotation — issue new pair, save new hash
    const tokens = await this.generateTokens(user);
    const hashedRefresh = await bcrypt.hash(tokens.refresh_token, 10);
    await this.usersService.saveRefreshToken(user.id, hashedRefresh);

    return tokens;
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.saveRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(user: User): Promise<{ access_token: string; refresh_token: string }> {
    const payload = { sub: user.id, username: user.username, role: user.role };

    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '1h') as any,
    });

    const refresh_token = this.jwtService.sign(
      { sub: user.id, username: user.username },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d') as any,
      },
    );

    return { access_token, refresh_token };
  }

  async signup(data: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
  }): Promise<{ message: string }> {
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const username = data.username.trim();
    const email = data.email.trim();

    const existingUsername = await this.usersService.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username is already taken, choose another username');
    }

    const existingEmail = await this.usersService.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException('Email is already taken, choose another email');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    await this.usersService.create({
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword,
    });

    return { message: 'Signup successful' };
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const valid = await this.verifyPassword(userId, currentPassword);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(userId, hashedPassword);
    return { message: 'Password updated successfully' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email.trim());

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.usersService.saveResetToken(user.id, token, expiry);

      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

      await this.mailService.sendResetEmail(user.email, resetUrl);
    }

    // Always return the same message to prevent email enumeration
    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByResetToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    return { message: 'Password reset successful' };
  }
}
