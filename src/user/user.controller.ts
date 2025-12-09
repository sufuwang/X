/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Post, Body, Res, Get, Req, Query } from '@nestjs/common';
import type { Request, Response } from 'express';
import { UserService } from './user.service';
import CreateUserDto from './dto/create-user.dto';
import LoginUserDto, {
  WXLoginUserDto,
  WXUserDto,
  UserIdentificationDto,
} from './dto/login-user.dto';
import { CookieOptions } from '../lib/cookies';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/user-existence')
  async userExistence(@Body() userIdentification: UserIdentificationDto) {
    return this.userService.userExistence(userIdentification);
  }

  @Post('/send-verifyCode')
  sendVerifyCode(@Body() { email }: UserIdentificationDto) {
    return this.userService.sendVerifyCode(email);
  }

  @Post('/check-verifyCode')
  async checkVerifyCode(@Body() body: UserIdentificationDto) {
    return this.userService.checkVerifyCode(body);
  }

  @Post('/register')
  async create(
    @Res({ passthrough: true }) res: Response,
    @Body() createUserDto: CreateUserDto,
  ) {
    const data = await this.userService.create(createUserDto);
    if (data.status !== 'Success') {
      return data;
    }
    return this.login(res, {
      email: createUserDto.email,
      password: createUserDto.password,
    });
  }

  @Post('/login')
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() loginUserDto: LoginUserDto,
  ) {
    const data = await this.userService.login(loginUserDto);
    res.cookie('access_token', data.access_token, CookieOptions);
    return {
      status: data.status,
      username: data.username,
      access_token: data.access_token,
      redirect_url: '/',
    };
  }

  @Get('/wx-info')
  async getWXInfo(@Query('user_id') user_id: string) {
    const { openid, session_key, ...data } =
      await this.userService.getWXInfo(user_id);
    return data;
  }

  @Post('/wx-login')
  async wxLogin(@Body() { code }: WXLoginUserDto) {
    const { openid, session_key, ...data } =
      await this.userService.wxLogin(code);
    return data;
  }

  @Post('/save-wx-info')
  async saveWxInfo(@Body() body: WXUserDto) {
    const { openid, session_key, ...data } =
      await this.userService.saveWxInfo(body);
    return data;
  }

  @Post('/logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.cookie('access_token', '');
    return 'success';
  }

  @Get('/auth')
  auth(@Req() req: Request) {
    return this.userService.auth(req.cookies.access_token);
  }

  @Get('/info')
  getInfo(@Req() req: Request) {
    return this.userService.getInfo(req.cookies.access_token);
  }
}
