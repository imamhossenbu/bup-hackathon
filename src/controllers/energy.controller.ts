import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { processEnergyOptimization } from '../services/energy.service.js';
import { checkDbHealth, getRecentOptimizations } from '../services/db.service.js';

const SERVER_START_TIME = Date.now();

export async function getHealth(req: Request, res: Response): Promise<void> {
  if (req.query.detailed === 'true') {
    const dbOk = await checkDbHealth();
    res.status(200).json({
      status: 'ok',
      uptime_seconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
      database: {
        provider: 'Neon PostgreSQL',
        connected: dbOk
      },
      llm: {
        primary: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        provider: 'Groq Cloud LPU',
        status: 'active'
      },
      solver: {
        engine: 'Simplex Linear Program (javascript-lp-solver)',
        status: 'ready'
      },
      memory: process.memoryUsage()
    });
    return;
  }

  res.status(200).json({ status: 'ok' });
}

export async function postOptimizeEnergy(req: Request, res: Response): Promise<void> {
  try {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      res.status(400).json({
        error: 'Malformed JSON or structurally invalid request'
      });
      return;
    }

    const response = await processEnergyOptimization(req.body);
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Malformed JSON or structurally invalid request',
        issues: error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Internal error';
    res.status(500).json({
      error: 'An internal error occurred during optimization processing',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    });
  }
}

export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = await getRecentOptimizations(15);
    res.status(200).json({ history });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve optimization history' });
  }
}
