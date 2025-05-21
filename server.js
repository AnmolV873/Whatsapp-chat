import express from 'express';
import bodyParser from 'body-parser';
import webhookRouter from './routes/webhook.routes.js';

export const startServer = () => {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use('/webhook', webhookRouter);

  app.listen(port, () => {
    console.log(` Server is running on port ${port}`);
  });
};
