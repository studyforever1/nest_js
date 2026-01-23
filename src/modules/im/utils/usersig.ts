// src/modules/im/utils/usersig.ts

// 1️⃣ 使用 require 引入旧版本 API
const TLSSigAPIv2 = require('tls-sig-api-v2');

/**
 * 生成 IM userSig
 * @param sdkAppId 腾讯云 IM 应用 SDKAppID
 * @param secretKey 管理员账号私钥
 * @param identifier 用户标识
 * @param expire 过期时间（秒），默认为 1 天
 */
export function genUserSig(
  sdkAppId: number,
  secretKey: string,
  identifier: string,
  expire: number = 86400
): string {
  if (!TLSSigAPIv2 || typeof TLSSigAPIv2.Api !== 'function') {
    console.error('💥 TLS SDK 导入失败', TLSSigAPIv2);
    throw new Error('tls-sig-api-v2 SDK 导入失败 – 请检查依赖安装情况');
  }

  const api = new TLSSigAPIv2.Api(sdkAppId, secretKey);
  // genSig 方法返回的就是 UserSig
  return api.genSig(identifier, expire);
}
