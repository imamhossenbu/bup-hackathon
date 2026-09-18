import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { processEnergyOptimization } from '../services/energy.service.js';

export function getHealth(req: Request, res: Response): void {
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
