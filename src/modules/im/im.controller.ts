import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ImService } from './im.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('IM')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
@Controller('im')
export class ImController {
  constructor(private readonly imService: ImService) {}

  /** 获取 IM 登录信息 */
  @Get('login')
  @ApiOperation({ summary: '获取 IM 登录信息' })
  getLoginInfo(@CurrentUser() user) {
    return this.imService.getLoginInfo(user.user_id);
  }
}
