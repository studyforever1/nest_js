import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { genUserSig } from './utils/usersig';
import { appConfig } from '../../config/app.config';

@Injectable()
export class ImService {
  private readonly sdkAppId = appConfig.im.sdkAppId;
  private readonly secretKey = appConfig.im.secretKey;

  constructor(private readonly http: HttpService) {}

  getLoginInfo(userId: number) {
    const identifier = `im_user_${userId}`;
    return {
      sdkAppId: this.sdkAppId,
      identifier,
      userSig: genUserSig(this.sdkAppId, this.secretKey, identifier),
    };
  }

async createImUser(user) {
  const adminIdentifier = appConfig.im.adminIdentifier;

  const url = `https://console.tim.qq.com/v4/im_open_login_svc/account_import` +
    `?sdkappid=${this.sdkAppId}` +
    `&identifier=${adminIdentifier}` +
    `&usersig=${genUserSig(this.sdkAppId, this.secretKey, adminIdentifier)}` +
    `&random=${Date.now()}` +
    `&contenttype=json`; // ✅ 必须加上 contenttype=json

  const res = await firstValueFrom(
    this.http.post(
      url,
      {
        Identifier: `im_user_${user.user_id}`,
        Nick: user.fullName || user.username,
      },
      {
        headers: {
          'Content-Type': 'application/json', // ✅ 必须
        },
      },
    ),
  );

  if (res.data.ActionStatus !== 'OK') {
    console.error('IM 用户创建失败:', res.data);
    throw new Error(`IM 用户创建失败: ${res.data.ErrorInfo || '未知错误'}`);
  }

  return res.data;
}

}
