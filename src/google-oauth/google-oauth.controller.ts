import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { GoogleOauthService } from './google-oauth.service';

@Controller()
export class GoogleOauthController {
  private readonly logger = new Logger(GoogleOauthController.name);

  constructor(private readonly oauth: GoogleOauthService) {}

  @Get('oauth/google/status')
  status() {
    return this.oauth.getStatus();
  }

  @Get('oauth/google/start')
  async start(@Res() res: { redirect: (url: string) => unknown }) {
    const { url } = this.oauth.getStartUrl();
    return res.redirect(url);
  }

  @Get('oauth2/callback')
  async callback(
    @Query('code') code: string,
    @Res()
    res: {
      status: (code: number) => {
        json: (payload: unknown) => unknown;
      };
    },
  ) {
    try {
      const out = await this.oauth.exchangeCode(code);
      return res.status(200).json(out);
    } catch (error) {
      const message = (error as Error).message;
      this.logger.warn(`Falha no callback OAuth2: ${message}`);
      return res.status(400).json({ ok: false, error: message });
    }
  }
}
