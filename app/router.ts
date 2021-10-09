import { Application } from 'egg';

export default (app: Application) => {
  const { controller, router } = app;

  router.get('/img', controller.home.img);
  router.get('/pdf', controller.home.pdf);
};
