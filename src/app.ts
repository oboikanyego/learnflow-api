import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.routes.js';
import { learningPathRouter } from './routes/learning-path.routes.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'learnflow-api' }));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/learning-paths', learningPathRouter);
app.use(errorHandler);
