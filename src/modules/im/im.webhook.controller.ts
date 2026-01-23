import { Controller, Post, Body } from '@nestjs/common';

@Controller('im/webhook')
export class ImWebhookController {

  @Post('after_send_msg')
  afterSend(@Body() body: any) {
    const from = body?.From_Account; // im_user_123
    const msg = body?.MsgBody;

    if (!from) {
      return { ActionStatus: 'FAIL', ErrorInfo: 'From_Account missing' };
    }

    const userId = Number(from.replace('im_user_', ''));

    // 👉 这里可以做：
    // 1. 消息落库
    // 2. 违规检测 / 风控
    // 3. 推送给前端或内部系统
    console.log('IM 消息回调:', userId, msg);

    return { ActionStatus: 'OK' };
  }
}
