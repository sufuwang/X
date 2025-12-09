import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { UserModule } from './user/user.module';
import { Mail } from './lib/mail';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 将 ConfigService 设为全局可用，这样就能在任何模块中使用而无需再次导入 ConfigModule
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env.local', '.env'],
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
    RedisModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    Mail.start();
  }
}
