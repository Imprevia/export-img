import { Service } from 'egg';
import { PuppeteerPool } from '../util/PuppeteerPool';

export default class Puppeteer extends Service {
  // 获取二进制图片
  public async getImage(data: {
    url: string

    cookies?: {
      name: string
      value: string
      path?: string
      domain?: string
    }[]
  }) {
    const pool = await PuppeteerPool.getInstance();
    const buffer = pool.use(async instance => {
      const page = await instance.newPage();
      if (data.cookies) {
        await page.setCookie(...data.cookies);
      }
      await page.goto(data.url);
      const buffer = await page.screenshot({ fullPage: true, type: 'jpeg' });
      await page.close();
      return buffer;
    });
    return buffer;
  }

  public async getPdf(data: {
    url: string
    cookies?: {
      name: string
      value: string
      path?: string
      domain?: string
    }[]
  }) {
    const pool = await PuppeteerPool.getInstance();
    const buffer = pool.use(async instance => {
      const page = await instance.newPage();
      if (data.cookies) {
        await page.setCookie(...data.cookies);
      }
      await page.goto(data.url);
      const buffer = await page.pdf({
        printBackground: true,
        margin: {
          top: 20,
          bottom: 20,
        },
      });
      await page.close();
      return buffer;
    });
    return buffer;
  }
}
