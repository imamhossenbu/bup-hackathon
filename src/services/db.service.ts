import pg from 'pg';
import dotenv from 'dotenv';
import { DirectiveInterpretation } from '../types/energy.js';

dotenv.config();

const { Pool } = pg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    })
  : null;

let tableInitialized = false;

async function ensureTable(): Promise<void> {
  if (!pool || tableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS optimization_logs (
        id SERIAL PRIMARY KEY,
        scenario_id VARCHAR(100) NOT NULL,
        operator_notes JSONB NOT NULL,
        directives JSONB NOT NULL,
        total_cost_bdt NUMERIC(12, 4) NOT NULL,
        total_grid_kwh NUMERIC(12, 4) NOT NULL,
        peak_grid_kwh NUMERIC(12, 4) NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_optimization_logs_scenario ON optimization_logs (scenario_id);
    `);
    tableInitialized = true;
  } catch (error) {
    console.error('PostgreSQL init error:', error instanceof Error ? error.message : error);
  }
}

export async function logOptimizationAsync(params: {
  scenarioId: string;
  notes: string[];
  directives: DirectiveInterpretation[];
  totalCost: number;
  totalGrid: number;
  peakGrid: number;
  executionTimeMs: number;
}): Promise<void> {
  if (!pool) return;
  try {
    await ensureTable();
    await pool.query(
      `INSERT INTO optimization_logs 
        (scenario_id, operator_notes, directives, total_cost_bdt, total_grid_kwh, peak_grid_kwh, execution_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.scenarioId,
        JSON.stringify(params.notes),
        JSON.stringify(params.directives),
        params.totalCost,
        params.totalGrid,
        params.peakGrid,
        params.executionTimeMs
      ]
    );
  } catch (error) {
    console.error('PostgreSQL async log error:', error instanceof Error ? error.message : error);
  }
}

export async function getRecentOptimizations(limit = 10): Promise<any[]> {
  if (!pool) return [];
  try {
    await ensureTable();
    const res = await pool.query(
      `SELECT id, scenario_id, total_cost_bdt, total_grid_kwh, peak_grid_kwh, execution_time_ms, created_at
       FROM optimization_logs
       ORDER BY id DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch (error) {
    console.error('PostgreSQL getRecent error:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function checkDbHealth(): Promise<boolean> {
  if (!pool) return false;
  try {
    const res = await pool.query('SELECT 1');
    return res.rowCount === 1;
  } catch {
    return false;
  }
}
