import { processEnergyOptimization } from '../src/services/energy.service.js';
import fs from 'fs';

const samplePack = JSON.parse(fs.readFileSync('public_sample_cases.json', 'utf8'));
const baseInput = samplePack.cases[0].input;

async function testZodValidation() {
  console.log('========================================================');
  console.log('--- Executing Zod Validation & Non-Negative Stress Tests ---');
  console.log('========================================================\n');

  const testCases = [
    {
      label: 'Negative demand_kwh',
      modifier: (d: any) => { d.hours[0].demand_kwh = -50; }
    },
    {
      label: 'Negative solar_kwh',
      modifier: (d: any) => { d.hours[5].solar_kwh = -10; }
    },
    {
      label: 'Negative tariff_bdt_per_kwh',
      modifier: (d: any) => { d.hours[12].tariff_bdt_per_kwh = -5; }
    },
    {
      label: 'Negative initial_energy_kwh',
      modifier: (d: any) => { d.battery.initial_energy_kwh = -20; }
    },
    {
      label: 'Negative capacity_kwh',
      modifier: (d: any) => { d.battery.capacity_kwh = -200; }
    },
    {
      label: 'Initial energy exceeding capacity',
      modifier: (d: any) => { d.battery.initial_energy_kwh = 300; d.battery.capacity_kwh = 200; }
    },
    {
      label: '500 operator notes (Exceeding max 3)',
      modifier: (d: any) => { d.operator_notes = Array(500).fill('Test note'); }
    },
    {
      label: '0 operator notes (Empty array)',
      modifier: (d: any) => { d.operator_notes = []; }
    },
    {
      label: '23 hours (Missing 1 hour)',
      modifier: (d: any) => { d.hours = d.hours.slice(0, 23); }
    },
    {
      label: 'Duplicate hour index (Two hour 0s)',
      modifier: (d: any) => { d.hours[1].hour = 0; }
    }
  ];

  let blockedCount = 0;

  for (const tc of testCases) {
    const inputCopy = JSON.parse(JSON.stringify(baseInput));
    tc.modifier(inputCopy);

    try {
      await processEnergyOptimization(inputCopy);
      console.log(`[FAILED] ${tc.label} was NOT blocked!`);
    } catch (err: any) {
      blockedCount++;
      const message = err.issues ? err.issues.map((i: any) => i.message).join('; ') : err.message;
      console.log(`[PASS - BLOCKED] ${tc.label} -> Properly rejected: "${message}"`);
    }
  }

  console.log(`\n--- Verification: Valid Input Returns 100% Non-Negative Output ---`);
  const validRes = await processEnergyOptimization(baseInput);

  let hasNegative = false;
  if (validRes.total_cost_bdt < 0 || Object.is(validRes.total_cost_bdt, -0)) hasNegative = true;
  if (validRes.total_grid_kwh < 0 || Object.is(validRes.total_grid_kwh, -0)) hasNegative = true;
  if (validRes.peak_grid_kwh < 0 || Object.is(validRes.peak_grid_kwh, -0)) hasNegative = true;

  for (const h of validRes.hourly_plan) {
    if (h.grid_kwh < 0 || Object.is(h.grid_kwh, -0)) hasNegative = true;
    if (h.solar_used_kwh < 0 || Object.is(h.solar_used_kwh, -0)) hasNegative = true;
    if (h.battery_kwh < 0 || Object.is(h.battery_kwh, -0)) hasNegative = true;
    if (h.battery_energy_after_kwh < 0 || Object.is(h.battery_energy_after_kwh, -0)) hasNegative = true;
  }

  console.log(`Any negative value in plan: ${hasNegative ? 'YES (FAIL)' : 'NO (100% Strictly Non-Negative)'}`);
  console.log(`Validation Score: ${blockedCount}/${testCases.length} Invalid Inputs Blocked.`);

  console.log('\n========================================================');
  process.exit(0);
}

testZodValidation();
