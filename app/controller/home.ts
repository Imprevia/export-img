import { Controller } from 'egg';

export default class HomeController extends Controller {
  public async img() {
    const { ctx } = this;
    const buffer = await ctx.service.puppeteer.getImage({
      url: 'https://www.baidu.com',
    });
    ctx.header.Accept = 'image/webp,image/apng,image/png,image/*,*/*;q=0.8';
    ctx.type = 'image/png';
    ctx.body = buffer;
  }
  public async pdf() {
    const { ctx } = this;
    const buffer = await ctx.service.puppeteer.getPdf({
      url: 'https://www.baidu.com',
    });
    this.ctx.set('Content-Type', 'application/octet-stream');
    // 下载
    // this.ctx.set('content-disposition', `attachment; filename="??.pdf"; filename*=UTF-8''${encodeURI('baidu')}.pdf`);
    this.ctx.type = '.pdf';
    ctx.body = buffer;
  }
}
