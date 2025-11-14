import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('聊天')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** 创建私聊房间 */
  @Post('create-room')
  @ApiOperation({ summary: '创建私聊房间' })
  @ApiBody({ schema: { type: 'object', properties: { userBId: { type: 'number', example: 2 } } } })
  async createPrivateRoom(
    @CurrentUser() user: User,
    @Body() body: { userBId: number },
  ) {
    return this.chatService.createPrivateRoom(user.user_id, body.userBId);
  }

  /** 创建群聊 */
  @Post('create-group')
  @ApiOperation({ summary: '创建群聊房间' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: '房间1' },
        memberIds: { type: 'array', items: { type: 'number' }, example: [2, 3] },
      },
    },
  })
  async createGroup(
    @CurrentUser() user: User,
    @Body() body: { name: string; memberIds: number[] },
  ) {
    return this.chatService.createGroup(user.user_id, body.name, body.memberIds);
  }

  /** 添加群成员 */
  @Post('group/add-user')
  @ApiOperation({ summary: '添加群成员' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        roomId: { type: 'number', example: 1 },
        userId: { type: 'number', example: 2 },
      },
    },
  })
  async addUser(@Body() body: { roomId: number; userId: number }) {
    return this.chatService.addUserToGroup(body.roomId, body.userId);
  }

  /** 移除群成员 */
  @Delete('group/remove-user/:roomId/:userId')
  @ApiOperation({ summary: '移除群成员' })
  @ApiParam({ name: 'roomId', type: Number, example: 1 })
  @ApiParam({ name: 'userId', type: Number, example: 2 })
  async removeUser(@Param('roomId') roomId: number, @Param('userId') userId: number) {
    return this.chatService.removeUserFromGroup(roomId, userId);
  }

  /** 获取当前用户所有房间 */
  @Get('my-rooms')
  @ApiOperation({ summary: '获取当前用户所有房间' })
  async myRooms(@CurrentUser() user: User) {
    return this.chatService.findUserRooms(user.user_id);
  }

  /** 获取房间成员（通过 room_key） */
@Get('room-members/:roomKey')
@ApiOperation({ summary: '获取房间内所有成员' })
@ApiParam({ name: 'roomKey', type: String, example: 'a8c3b2d1-16bd-4eea-8ad4-e10f2fa6f804' })
async roomMembers(@Param('roomKey') roomKey: string) {
  return this.chatService.getRoomMembersByKey(roomKey);
}

/** 发送消息（通过 room_key） */
@Post('send')
@ApiOperation({ summary: '发送消息' })
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      roomKey: { type: 'string', example: 'a8c3b2d1-16bd-4eea-8ad4-e10f2fa6f804' },
      content: { type: 'string', example: '你好' },
    },
  },
})
async sendMessage(
  @CurrentUser() user: User,
  @Body() body: { roomKey: string; content: string },
) {
  return this.chatService.sendMessageByKey(user.user_id, body.roomKey, body.content);
}

/** 获取房间消息历史（通过 room_key） */
@Get('history/:roomKey')
@ApiOperation({ summary: '获取房间消息历史' })
@ApiParam({ name: 'roomKey', type: String, example: 'a8c3b2d1-16bd-4eea-8ad4-e10f2fa6f804' })
async history(@Param('roomKey') roomKey: string) {
  return this.chatService.getHistoryByKey(roomKey);
}


}
