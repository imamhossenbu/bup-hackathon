import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getHealth, postOptimizeEnergy, getHistory } from './controllers/energy.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app: Express = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

app.get('/health', getHealth);
app.post('/optimize-energy', postOptimizeEnergy);
app.get('/api/history', getHistory);

app.get('/public_sample_cases.json', (req: Request, res: Response) => {
  const rootPath = path.join(__dirname, '../public_sample_cases.json');
  res.sendFile(rootPath);
});

app.get('/dashboard', (req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Malformed JSON payload' });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
});

export default app;

