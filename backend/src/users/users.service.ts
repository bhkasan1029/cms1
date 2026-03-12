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

  async updateName(userId: string, firstName: string, lastName: string): Promise<User | null> {
    await this.usersRepository.update(userId, { firstName, lastName });
    return this.usersRepository.findOne({ where: { id: userId } });
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

  async restoreUser(userId: string): Promise<User | null> {
    await this.usersRepository.update(userId, {
      deletedAt: null as any,
    });
    return this.usersRepository.findOne({ where: { id: userId } });
  }

  async updateEmailNotificationsEnabled(userId: string, enabled: boolean): Promise<User | null> {
    await this.usersRepository.update(userId, { emailNotificationsEnabled: enabled });
    return this.usersRepository.findOne({ where: { id: userId } });
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
