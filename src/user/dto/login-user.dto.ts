import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  Length,
  IsOptional,
} from 'class-validator';

export default class LoginUserDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: '密码必须包含至少一个大写字母、一个小写字母和一个数字',
  })
  password: string;
}

export class UserIdentificationDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @IsString()
  @Length(6, 6)
  @IsOptional()
  verifyCode: string;
}

export class WXLoginUserDto {
  @IsString()
  code: string;
}

export class WXUserDto {
  @IsString()
  user_id: string;

  @IsString()
  conversation_id: string;

  @IsString()
  avatar_url: string;

  @IsString()
  nickname: string;
}
