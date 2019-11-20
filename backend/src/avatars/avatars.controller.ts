import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { AvatarsService } from './avatars.service';

@Controller('avatar')
export class AvatarsController {
  constructor(private avatarService: AvatarsService) {}

  @Get()
  @Header('Content-disposition', 'inline')
  public async getAvatarForUser(@Query('login') login: string, @Res() res) {
    try {
      const avatarResponse = await this.avatarService.getAvatarByLogin(login);
      res.set('Content-Type', avatarResponse.headers['content-type']);
      res.send(avatarResponse.data);
      res.end();
    } catch (err) {
      res.sendStatus(404);
    }
  }
}
