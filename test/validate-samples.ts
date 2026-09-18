import { processEnergyOptimization } from '../src/services/energy.service.js';
import fs from 'fs';
import path from 'path';

const samplePackPath = path.resolve('public_sample_cases.json');

let cases: any[] = [];

if (fs.existsSync(samplePackPath)) {
  const content = JSON.parse(fs.readFileSync(samplePackPath, 'utf8'));
  cases = content.cases || [];
}

async function runAll() {
  console.log(`--- Running ${cases.length} Sample Cases ---`);
  let passed = 0;

  for (const c of cases) {
    const t0 = Date.now();
    try {
      const res = await processEnergyOptimization(c.input);
      const elapsed = Date.now() - t0;
      const expectedCost = c.expected_output?.total_cost_bdt || 0;
      const diff = Math.abs(res.total_cost_bdt - expectedCost);
      const isPass = diff <= 1.0;
      if (isPass) passed++;

      console.log(`[${isPass ? 'PASS' : 'WARN'}] ${c.id}: ${c.label} | Team: ${res.total_cost_bdt} | Expected: ${expectedCost} | Diff: ${diff.toFixed(2)} | Latency: ${elapsed}ms`);
    } catch (err) {
      console.error(`[FAIL] ${c.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`--- Test Summary: ${passed}/${cases.length} Optimal Reference Matches ---`);
  process.exit(0);
}

runAll();
