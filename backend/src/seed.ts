import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const username = 'bhumi';
  const existing = await usersService.findByUsername(username);

  if (!existing) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);
    const user = await usersService.create({
      firstName: 'Bhumi',
      lastName: 'Kasangottuwar',
      username,
      email: 'bhkasan1029@gmail.com',
      password: hashedPassword,
    });
    await usersService.updateRole(user.id, 'admin');
    console.log(`Admin user "${username}" created successfully.`);
  } else {
    console.log(`User "${username}" already exists. Skipping.`);
  }

  await app.close();
}

seed();
