import { Injectable, UnauthorizedException } from '@nestjs/common';
import CreateUserDto from './dto/create-user.dto';
import LoginUserDto, {
  WXUserDto,
  UserIdentificationDto,
} from './dto/login-user.dto';
import { RedisService } from 'src/redis/redis.service';
import { randomUUID as uuid } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { CookieOptions } from '../lib/cookies';
import axios from 'axios';
import { sendVerifyCode } from '../lib/mail';
import { differenceInSeconds, format } from 'date-fns';

@Injectable()
export class UserService {
  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  getAccessToken(userId: string, email: string) {
    return this.jwtService.sign({
      email,
      userId,
      domain: CookieOptions.domain,
      salt: Math.floor(Math.random() * Math.pow(10, 12)),
    });
  }

  async userExistence(userIdentification: UserIdentificationDto) {
    const username = await this.redisService.client.hGet(
      `users:${userIdentification.email}`,
      'username',
    );
    return {
      status: username ? 'UserExist' : 'UserNotFound',
    };
  }

  async sendVerifyCode(email: string) {
    try {
      const info = await this.redisService.client.hGetAll(
        `verifyCode:${email}`,
      );
      if (info) {
        const diffCreateAt = differenceInSeconds(Date.now(), info.createAt);
        if (diffCreateAt > 0 && diffCreateAt < 60) {
          return {
            status: 'CalmingDown',
            message: `请稍后再试，还需等待 ${60 - diffCreateAt} 秒`,
            time: 60 - diffCreateAt,
          };
        }
      }
      const { verifyCode } = await sendVerifyCode([email]);
      const key = `verifyCode:${email}`;
      this.redisService.client.hSet(key, {
        createAt: format(Date.now(), 'yyyy-MM-dd HH:mm:ss'),
        verifyCode,
        email,
      });
      this.redisService.client.expire(key, 60 * 10);
      return {
        status: 'Success',
        time: 60,
      };
    } catch (error) {
      return {
        status: 'Failure',
        message: error.toString(),
      };
    }
  }

  async checkVerifyCode({ email, verifyCode }: UserIdentificationDto) {
    const info = await this.redisService.client.hGetAll(`verifyCode:${email}`);
    if (!info || !info.verifyCode) {
      return {
        status: 'Failure',
        message: '未找到对应验证码',
      };
    }
    const diffCreateAt = differenceInSeconds(Date.now(), info.createAt);
    if (diffCreateAt > 60 * 10) {
      return {
        status: 'Failure',
        message: '验证码已过期',
      };
    }
    if (info.verifyCode === verifyCode) {
      return {
        status: 'Success',
      };
    }
    return {
      status: 'VerifyCodeError',
      message: '验证码错误',
    };
  }

  async create(createUserDto: CreateUserDto) {
    const usersScan = this.redisService.client.scanIterator({
      MATCH: 'users:*',
      COUNT: 100,
    });
    const { value: usedEmails } = await usersScan.next();
    const curUserEmail = `users:${createUserDto.email}`;

    if (Array.isArray(usedEmails)) {
      if (usedEmails.length > 10) {
        throw new Error('已达到创建用户的上限');
      }
      if (usedEmails.includes(curUserEmail)) {
        throw new Error('当前邮箱已被占用');
      }
      // for (const key of usedEmails) {
      //   const username = await this.redisService.client.hGet(key, 'username');
      //   if (username === createUserDto.username) {
      //     throw new Error('当前昵称已被占用');
      //   }
      // }
    }

    const data = await this.checkVerifyCode({
      email: createUserDto.email,
      verifyCode: createUserDto.verifyCode,
    });
    if (data?.status !== 'Success') {
      return data;
    }

    const random = Math.ceil(Math.random() * 100000000);
    createUserDto.username = `${createUserDto.username}.${random}`;

    const userId = uuid();
    await Promise.all([
      ...Object.entries(createUserDto)
        .filter((row) => row[1])
        .map((row) => this.redisService.client.hSet(curUserEmail, ...row)),
      this.redisService.client.hSet(curUserEmail, 'userId', userId),
    ]);

    return {
      access_token: this.getAccessToken(userId, createUserDto.email),
      directUrl: '/sign-in',
      status: 'Success',
    };
  }

  async login(loginUserDto: LoginUserDto) {
    const curUserEmail = `users:${loginUserDto.email}`;
    const user = await this.redisService.client.hGetAll(curUserEmail);

    if (!user.userId) {
      return {
        status: 'UserNotFound',
      };
    }
    if (user.password !== loginUserDto.password) {
      return {
        status: 'PasswordError',
      };
    }
    return {
      status: 'Success',
      username: user.username,
      access_token: this.getAccessToken(user.userId, user.email),
    };
  }

  async getWXInfo(user_id: string): Promise<WXUserInfo> {
    const openid = await this.redisService.client.get(`wx_user_id:${user_id}`);
    if (!openid) {
      throw new Error('未找到微信用户');
    }
    return this.redisService.client.hGetAll(
      `wx_users:${openid}`,
    ) as unknown as Promise<WXUserInfo>;
  }

  async wxLogin(js_code: string): Promise<WXUserInfo> {
    const { data } = await axios.get(
      'https://api.weixin.qq.com/sns/jscode2session',
      {
        params: {
          appid: process.env.WX_APPID,
          secret: process.env.WX_SECRET,
          js_code,
          grant_type: 'authorization_code',
        },
      },
    );
    if (!data.openid) {
      throw new Error(data.errmsg || '微信登录失败');
    }
    const key = `wx_users:${data.openid}`;
    const user = (await this.redisService.client.hGetAll(
      key,
    )) as unknown as WXUserInfo;
    if (user.openid) {
      return user;
    }
    const row: WXUserInfo = {
      ...data,
      user_id: uuid(),
      conversation_id: uuid(),
    };
    await Promise.all([
      this.redisService.client.hSet(key, row as any),
      this.redisService.client.set(`wx_user_id:${row.user_id}`, row.openid),
    ]);
    return row;
  }

  async saveWxInfo(wxUserDto: WXUserDto): Promise<WXUserInfo> {
    const openid = await this.redisService.client.get(
      `wx_user_id:${wxUserDto.user_id}`,
    );
    if (!openid) {
      throw new Error('未找到微信用户');
    }
    const user = (await this.redisService.client.hGetAll(
      `wx_users:${openid}`,
    )) as unknown as WXUserInfo;
    const data = Object.assign(user, wxUserDto);
    await this.redisService.client.hSet(`wx_users:${data.openid}`, data as any);
    return data;
  }

  auth(accessToken: string | undefined) {
    if (!accessToken) {
      return { redirect_url: '/sign-in' };
    }
    try {
      const user = this.jwtService.verify(accessToken);
      if (!user) {
        return { redirect_url: '/sign-in' };
      }
      return { data: 'success' };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token 已过期');
      } else {
        throw new UnauthorizedException('Token 无效');
      }
    }
  }

  async getInfo(accessToken: string) {
    const tokenInfo = this.jwtService.verify(accessToken);
    if (!tokenInfo) {
      return new Error('当前用户不存在');
    }
    const userInfo = await this.redisService.client.hGetAll(
      `users:${tokenInfo.email}`,
    );
    return {
      username: userInfo.username,
      email: userInfo.email,
    };
  }
}
