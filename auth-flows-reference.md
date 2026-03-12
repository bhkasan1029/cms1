# slateCMS — Forgot Password & Token Flow Reference

---

## 1. Forgot Password Flow

### `backend/src/auth/dto/forgot-password.dto.ts`

```typescript
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
```

---

### `backend/src/auth/dto/reset-password.dto.ts`

```typescript
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

---

### `backend/src/auth/auth.controller.ts`

```typescript
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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateBioDto } from './dto/update-bio.dto';
import { AdminActionDto } from './dto/admin-action.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { HobbyDTO } from './dto/hobby.dto';
import { UsersService } from 'src/users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
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
  @Patch('account/bio')
  async updateBio(@Request() req: any, @Body() dto: UpdateBioDto) {
    const user = await this.usersService.updateBio(req.user.userId, dto.bio);
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
    const user = await this.usersService.blockUser(id, !target.isBlocked);
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
    return { message: 'Account scheduled for deletion in 24 hours' };
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
```

---

### `backend/src/auth/auth.service.ts`

```typescript
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
    const user =
      (await this.usersService.findByUsername(usernameOrEmail)) ??
      (await this.usersService.findByEmail(usernameOrEmail));

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
    const existingUsername = await this.usersService.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictException('Username is already taken, choose another username');
    }

    const existingEmail = await this.usersService.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictException('Email is already taken, choose another email');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    await this.usersService.create({
      firstName: data.firstName,
      lastName: data.lastName,
      username: data.username,
      email: data.email,
      password: hashedPassword,
    });

    return { message: 'Signup successful' };
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

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
```

---

### `backend/src/users/users.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, IsNull, Repository } from 'typeorm';
import { User } from './user.entity';
import { Hobbies } from './hobby.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Hobbies)
    private readonly hobbiesRepository: Repository<Hobbies>,
  ) { }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async updateRole(userId: string, role: string): Promise<User | null> {
    await this.usersRepository.update(userId, { role });
    return this.usersRepository.findOne({ where: { id: userId } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findUserHobbyByUsername(username: string): Promise<Hobbies | null> {
    return this.hobbiesRepository.findOne({ where: { hobby: username } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async create(data: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
  }): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async saveResetToken(
    userId: string,
    token: string,
    expiry: Date,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      resetToken: token,
      resetTokenExpiry: expiry,
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: MoreThan(new Date()),
      },
    });
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.usersRepository.update(userId, {
      password: hashedPassword,
      resetToken: null as any,
      resetTokenExpiry: null as any,
    });
  }

  async saveRefreshToken(userId: string, hashedToken: string | null): Promise<void> {
    await this.usersRepository.update(userId, { refreshToken: hashedToken as any });
  }

  async updateBio(userId: string, bio: string): Promise<User | null> {
    await this.usersRepository.update(userId, { bio });
    return this.usersRepository.findOne({ where: { id: userId } });
  }

  async blockUser(userId: string, blocked: boolean): Promise<User | null> {
    await this.usersRepository.update(userId, {
      isBlocked: blocked,
      refreshToken: null as any,
    });
    return this.usersRepository.findOne({ where: { id: userId } });
  }

  async softDeleteUser(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      deletedAt: new Date(),
      refreshToken: null as any,
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.usersRepository.delete(userId);
  }

  async permanentlyDeleteExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expired = await this.usersRepository.find({
      where: {
        deletedAt: Not(IsNull()) as any,
      },
    });
    const toDelete = expired.filter((u) => u.deletedAt && u.deletedAt <= cutoff);
    if (toDelete.length > 0) {
      await this.usersRepository.delete(toDelete.map((u) => u.id));
    }
    return toDelete.length;
  }
}
```

---

### `backend/src/users/user.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  age: number;

  @Column({ type: 'varchar', default: 'user' })
  role: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', nullable: true })
  refreshToken: string;

  @Column({ type: 'varchar', nullable: true })
  resetToken: string;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpiry: Date;

  @Column({ type: 'boolean', default: false })
  isBlocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
```

---

### `backend/src/mail/mail.service.ts`

```typescript
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

  async sendResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
//       Nodemailer opens a connection to SMTP_HOST
// It sends SMTP commands like:
// "hello"
// "email from X"
// "email to Y"
// "here is the message"
// The SMTP server sends the email
      from: `"CMS App" <${this.configService.get<string>('SMTP_USER')}>`,
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
}
```

---

### `frontend/src/pages/LoginPage.tsx`

```typescript
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signupApi, forgotPasswordApi } from '../api/auth';
import axios from 'axios';

type Mode = 'login' | 'signup' | 'forgot';

function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');

  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Signup fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Forgot password field
  const [forgotEmail, setForgotEmail] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pick up success message from ResetPasswordPage redirect
  const locationState = location.state as { success?: string } | null;
  if (locationState?.success && !success) {
    setSuccess(locationState.success);
    window.history.replaceState({}, '');
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Invalid username or password');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      await signupApi({
        firstName,
        lastName,
        username: signupUsername,
        email,
        password: signupPassword,
      });

      setUsername(signupUsername);
      setPassword('');
      setMode('login');
      setSuccess('Account created successfully! Please log in.');

      setFirstName('');
      setLastName('');
      setSignupUsername('');
      setEmail('');
      setSignupPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Signup failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await forgotPasswordApi({ email: forgotEmail });
      setSuccess(response.message);
      setForgotEmail('');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setError('');
    setSuccess('');
  }

  return (
    <div className="login-container">
      {mode === 'login' && (
        <>
          <h1>Sign In</h1>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
              </span>
              <label htmlFor="username">Username or Email</label>
              <input
                id="username"
                type="text"
                placeholder="Username or Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="input-group">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {success && <p className="success">{success}</p>}
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div className="login-footer">
            <button
              type="button"
              className="toggle-btn"
              onClick={() => switchMode('signup')}
            >
              Create Account
            </button>
            <button
              type="button"
              className="toggle-btn"
              onClick={() => switchMode('forgot')}
            >
              Forgot Password?
            </button>
          </div>
        </>
      )}

      {mode === 'signup' && (
        <>
          <h1>Sign Up</h1>
          <form onSubmit={handleSignup}>
            <div className="input-group">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
              </span>
              <label htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>
              </span>
              <label htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <label htmlFor="signupUsername">Username</label>
              <input
                id="signupUsername"
                type="text"
                placeholder="Username"
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="input-group">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </span>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="input-group">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <label htmlFor="signupPassword">Password</label>
              <input
                id="signupPassword"
                type="password"
                placeholder="Password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="input-group">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing up...' : 'Sign Up'}
            </button>
          </form>
          <p className="toggle-text">
            {'Already have an account? '}
            <button
              type="button"
              className="toggle-btn"
              onClick={() => switchMode('login')}
            >
              Sign In
            </button>
          </p>
        </>
      )}

      {mode === 'forgot' && (
        <>
          <h1>Forgot Password</h1>
          <p className="subtitle">Enter your email to receive a reset link.</p>
          <form onSubmit={handleForgotPassword}>
            <div className="input-group">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </span>
              <label htmlFor="forgotEmail">Email</label>
              <input
                id="forgotEmail"
                type="email"
                placeholder="Email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            {success && <p className="success">{success}</p>}
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          <p className="toggle-text">
            <button
              type="button"
              className="toggle-btn"
              onClick={() => switchMode('login')}
            >
              Back to Sign In
            </button>
          </p>
        </>
      )}
    </div>
  );
}

export default LoginPage;
```

---

### `frontend/src/pages/ResetPasswordPage.tsx`

```typescript
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPasswordApi } from '../api/auth';
import axios from 'axios';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="login-container">
        <h1>Invalid Link</h1>
        <p className="error">No reset token found. Please request a new password reset link.</p>
        <p className="toggle-text">
          <button
            type="button"
            className="toggle-btn"
            onClick={() => navigate('/login')}
          >
            Back to Sign In
          </button>
        </p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPasswordApi({ token: token!, password });
      navigate('/login', {
        state: { success: 'Password reset successful! Please log in with your new password.' },
      });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-container">
      <h1>Reset Password</h1>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <span className="input-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <label htmlFor="newPassword">New Password</label>
          <input
            id="newPassword"
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="input-group">
          <span className="input-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <label htmlFor="confirmNewPassword">Confirm New Password</label>
          <input
            id="confirmNewPassword"
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}

export default ResetPasswordPage;
```

---

### `frontend/src/api/auth.ts`

```typescript
import apiClient from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  role: string;
}

export interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: string;
  bio?: string;
  isBlocked?: boolean;
  deletedAt?: string;
  createdAt: string;
}

export interface SignupRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  message: string;
}

export async function signupApi(
  data: SignupRequest,
): Promise<SignupResponse> {
  const response = await apiClient.post<SignupResponse>('/auth/signup', data);
  return response.data;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface MessageResponse {
  message: string;
}

export async function forgotPasswordApi(
  data: ForgotPasswordRequest,
): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>(
    '/auth/forgot-password',
    data,
  );
  return response.data;
}


export async function resetPasswordApi(
  data: ResetPasswordRequest,
): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>(
    '/auth/reset-password',
    data,
  );
  return response.data;
}

export async function loginApi(
  credentials: LoginRequest,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    '/auth/login',
    credentials,
  );
  return response.data;
}

export async function refreshTokenApi(
  refreshToken: string,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return response.data;
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getAccountApi(): Promise<UserRecord> {
  const response = await apiClient.get<UserRecord>('/auth/account');
  return response.data;
}

export async function getProfileApi(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>('/auth/profile');
  return response.data;
}

export async function getUsersApi(): Promise<UserRecord[]> {
  const response = await apiClient.get<UserRecord[]>('/auth/users');
  return response.data;
}

export async function updateUserRoleApi(
  userId: string,
  role: string,
): Promise<UserRecord> {
  const response = await apiClient.patch<UserRecord>(
    `/auth/users/${userId}/role`,
    { role },
  );
  return response.data;
}

export async function updateBioApi(bio: string): Promise<UserRecord> {
  const response = await apiClient.patch<UserRecord>('/auth/account/bio', { bio });
  return response.data;
}

export async function getUserByIdApi(userId: string): Promise<UserRecord> {
  const response = await apiClient.get<UserRecord>(`/auth/users/${userId}`);
  return response.data;
}

export async function deleteUserApi(userId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/auth/users/${userId}`);
  return response.data;
}

export async function blockUserApi(userId: string, password: string): Promise<UserRecord> {
  const response = await apiClient.patch<UserRecord>(
    `/auth/users/${userId}/block`,
    { password },
  );
  return response.data;
}

export async function softDeleteUserApi(userId: string, password: string): Promise<{ message: string }> {
  const response = await apiClient.patch<{ message: string }>(
    `/auth/users/${userId}/soft-delete`,
    { password },
  );
  return response.data;
}
```

---

## 2. Access & Refresh Token Flow

### `backend/.env`

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=apple
DB_PASSWORD=
DB_NAME=cms

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRATION=1h
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
JWT_REFRESH_EXPIRATION=7d

# SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=slateCMS1@gmail.com
SMTP_PASS=zwrp nqft pfaf mczy
FRONTEND_URL=http://localhost:5173
```

---

### `backend/src/auth/dto/refresh-token.dto.ts`

```typescript
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  refresh_token: string;
}
```

---

### `backend/src/auth/strategies/jwt.strategy.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: { sub: string; username: string; role: string }) {
    return { userId: payload.sub, username: payload.username, role: payload.role };
  }
}
```

---

### `backend/src/auth/guards/jwt-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

---

### `backend/src/auth/auth.controller.ts`

> See Section 1 above.

### `backend/src/auth/auth.service.ts`

> See Section 1 above.

### `frontend/src/api/auth.ts`

> See Section 1 above.

### `backend/src/users/users.service.ts`

> See Section 1 above.

### `backend/src/users/user.entity.ts`

> See Section 1 above.

---

### `frontend/src/api/client.ts`

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  },
);

// Track whether a refresh is already in progress
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config || !error.response) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    // If 401 and we haven't already retried this request
    if (error.response.status === 401 && !originalRequest._retry) {
      // Don't try to refresh if the failing request IS the refresh endpoint
      if (originalRequest.url === '/auth/refresh') {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject: (err: unknown) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post('http://localhost:3000/auth/refresh', {
          refresh_token: refreshToken,
        });

        // Store new tokens
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);

        processQueue(null, data.access_token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
```

---

### `frontend/src/context/AuthContext.tsx`

```typescript
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import { loginApi, getProfileApi, logoutApi } from '../api/auth';
import type { UserProfile } from '../api/auth';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('token'),
  );
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = token !== null && user !== null;

  useEffect(() => {
    if (token) {
      getProfileApi()
        .then((profile) => {
          setUser(profile);
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await loginApi({ username, password });
    localStorage.setItem('token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    setToken(response.access_token);
    const profile = await getProfileApi();
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore errors — clear local state regardless
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```
