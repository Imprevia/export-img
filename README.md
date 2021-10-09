# 说明

Puppeteer 是一个node库，他提供了一组用来操纵Chrome的API, 通俗来说就是一个 headless chrome浏览器。既然是浏览器，那么我们手工可以在浏览器上做的事情 Puppeteer 都能胜任：

* 生成网页截图或者 PDF（vue这类的SPA也可以生成网页截图或者 PDF）
* 高级爬虫，可以爬取大量异步渲染内容的网页
* 模拟键盘输入、表单自动提交、登录网页等，实现 UI 自动化测试
* 捕获站点的时间线，以便追踪你的网站，帮助分析网站性能问题

我们使用egg.js作为http服务，通过调用puppeteer 生成图片和PDF返回二进制给浏览器。



# 搭建环境

* 安装`egg.js`

  ```
  npm i egg-init -g
  ```

* 创建项目

  ```bash
  egg-init export-img --type=ts
  cd G:\node\export-img
  yarn
  ```

* 安装`puppeteer`

  ```
  yarn add puppeteer --save
  ```

  安装`puppeteer`需要梯子，yarn设置代理的方法

  ```
  # 设置代理
  yarn config set proxy 代理地址
  # 删除代理
  yarn config delete proxy
  ```



# 导出pdf和图片

* 创建`Puppeteer.ts`

  ```typescript
  import { Service } from 'egg';
  import * as puppeteer from 'puppeteer';
  
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
      const browser = await puppeteer.launch({
        args: [
          // Required for Docker version of Puppeteer
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // This will write shared memory files into /tmp instead of /dev/shm,
          // because Docker’s default for /dev/shm is 64MB
          '--disable-dev-shm-usage',
        ],
        headless: true,
      });
      const page = await browser.newPage();
      if (data.cookies) {
        await page.setCookie(...data.cookies);
      }
      await page.goto(data.url);
      const buffer = await page.screenshot({ fullPage: true, type: 'jpeg' });
      await browser.close();
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
      const browser = await puppeteer.launch({
        args: [
          // Required for Docker version of Puppeteer
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // This will write shared memory files into /tmp instead of /dev/shm,
          // because Docker’s default for /dev/shm is 64MB
          '--disable-dev-shm-usage',
        ],
        headless: true,
      });
      const page = await browser.newPage();
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
      await browser.close();
      return buffer;
    }
  }
  
  ```

* 修改`home.ts`

  ```typescript
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
  
  ```

* 修改`router.ts`

  ```typescript
  import { Application } from 'egg';
  
  export default (app: Application) => {
    const { controller, router } = app;
  
    router.get('/img', controller.home.img);
    router.get('/pdf', controller.home.pdf);
  };
  
  ```

* 文件架构

  ![](https://raw.githubusercontent.com/Imprevia/Drawing_bed/main/img/20211009183447.png)



* 启动

  ```
  yarn dev
  ```



* 测试

    * 导出图片

      ![](https://raw.githubusercontent.com/Imprevia/Drawing_bed/main/img/20211009183639.png)

    * 导出pdf

      ![](https://raw.githubusercontent.com/Imprevia/Drawing_bed/main/img/20211009183742.png)





# 问题

使用`jmeter`做压测发现内存暴了，导致服务重启。

原因：每一次请求都去产生一个 puppeteer 实例。产生一个 puppeteer 实例就等于打开一个chrome，这是一个非常消耗性能的行为。



# 优化

使用连接池（generic-pool）优化。

* 安装`generic-pool`

  ```
  yarn add generic-pool -S
  ```

* 创建`PuppeteerPool`

  ```typescript
  import * as puppeteer from 'puppeteer';
  import * as genericPool from 'generic-pool';
  
  interface IPuppeteerPool {
    max?: number,
    min?: number,
    maxUses?: number,
    testOnBorrow?: boolean,
    autostart?: boolean,
    idleTimeoutMillis?: number,
    evictionRunIntervalMillis?: number,
    puppeteerArgs?: number,
    validator?: () => Promise<boolean>,
  }
  
  export class PuppeteerPool {
  
    private static _instance:PuppeteerPool;
    private _options:IPuppeteerPool;
    private _useCount = 0;
    private _browser:any;
    private _pool:any;
  
    public static async getInstance(options: IPuppeteerPool = {}) {
      if (!this._instance) {
        this._instance = new PuppeteerPool(options);
        await this._instance.init();
      }
      return this._instance;
    }
  
    /**
       * 初始化一个 Puppeteer 池
       * @param {Object} [options={}] 创建池的配置配置
       * @param {Number} [options.max=10] 最多产生多少个 puppeteer 实例 。如果你设置它，请确保 在引用关闭时调用清理池。 pool.drain().then(()=>pool.clear())
       * @param {Number} [options.min=1] 保证池中最少有多少个实例存活
       * @param {Number} [options.maxUses=2048] 每一个 实例 最大可重用次数，超过后将重启实例。0表示不检验
       * @param {Number} [options.testOnBorrow=2048] 在将 实例 提供给用户之前，池应该验证这些实例。
       * @param {Boolean} [options.autostart=false] 是不是需要在 池 初始化时 初始化 实例
       * @param {Number} [options.idleTimeoutMillis=3600000] 如果一个实例 60分钟 都没访问就关掉他
       * @param {Number} [options.evictionRunIntervalMillis=180000] 每 3分钟 检查一次 实例的访问状态
       * @param {Object} [options.puppeteerArgs={}] puppeteer.launch 启动的参数
       * @param {Function} [options.validator=(instance)=>Promise.resolve(true))] 用户自定义校验 参数是 取到的一个实例
       * @param {Object} [options.otherConfig={}] 剩余的其他参数 // For all opts, see opts at https://github.com/coopernurse/node-pool#createpool
       * @return {Object} pool
       */
    constructor(options: IPuppeteerPool = {}) {
      this._options = options;
    }
  
    public async init() {
      await this._initBrowser();
      this._initPool();
    }
  
    private async _initBrowser() {
      // 创建一个 puppeteer 实例
      this._browser = await puppeteer.launch({
        args: [
          // Required for Docker version of Puppeteer
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // This will write shared memory files into /tmp instead of /dev/shm,
          // because Docker’s default for /dev/shm is 64MB
          '--disable-dev-shm-usage',
        ],
        headless: true,
      });
    }
  
    private _initPool() {
  
      const {
        max = 10,
        min = 2,
        maxUses = 2028,
        testOnBorrow = true,
        autostart = false,
        idleTimeoutMillis = 3600000,
        evictionRunIntervalMillis = 180000,
        puppeteerArgs = {},
        validator = (instance:any) => Promise.resolve(true),
        ...otherConfig
      } = this._options;
  
      const factory = {
        create: async () => {
          // 创建一个匿名的浏览器上下文
          const instance = this._browser;
          // 创建一个 puppeteer 实例 ，并且初始化使用次数为 0
          this._useCount = 0;
          return await instance.createIncognitoBrowserContext();
        },
        destroy: instance => {
          instance.close();
        },
        validate: instance => {
          // 执行一次自定义校验，并且校验校验 实例已使用次数。 当 返回 reject 时 表示实例不可用
          return validator(instance).then(valid => Promise.resolve(valid && (maxUses <= 0 || this._useCount < maxUses)));
        },
      };
      const config = {
        max,
        min,
        testOnBorrow,
        autostart,
        idleTimeoutMillis,
        evictionRunIntervalMillis,
        ...otherConfig,
      };
      this._pool = genericPool.createPool(factory, config);
      const genericAcquire = this._pool.acquire.bind(this._pool);
      // 重写了原有池的消费实例的方法。添加一个实例使用次数的增加
      this._pool.acquire = () =>
        genericAcquire().then(instance => {
          this._useCount += 1;
          return instance;
        });
    }
  
    public async use(fn:(instance:any)=>Promise<any>) {
      let resource;
      return this._pool
        .acquire()
        .then(async r => {
          resource = r;
          return resource;
        })
        .then(fn)
        .then(
          result => {
            // 不管业务方使用实例成功与后都表示一下实例消费完成
            this._pool.release(resource);
            return result;
          },
          err => {
            this._pool.release(resource);
            throw err;
          },
        );
    }
  
    get pool(): any {
      return this._pool;
    }
  }
  ```

* 修改`Puppeteer.ts`

  ```typescript
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
  ```

  