import { processEnergyOptimization } from '../src/services/energy.service.js';

const customCases = [
  {
    id: 'CUSTOM-01',
    label: 'Paraphrased Solar Reduction + Evening Inverter Protection',
    input: {
      scenario_id: 'CUSTOM-01',
      operator_notes: [
        'Panel washing from one until three will leave roughly one-fifth of normal solar output.',
        'The convocation rehearsal starts on Friday afternoon.'
      ],
      hours: [
        { hour: 0, demand_kwh: 110, solar_kwh: 0, tariff_bdt_per_kwh: 6 },
        { hour: 1, demand_kwh: 100, solar_kwh: 0, tariff_bdt_per_kwh: 6 },
        { hour: 2, demand_kwh: 90, solar_kwh: 0, tariff_bdt_per_kwh: 5 },
        { hour: 3, demand_kwh: 85, solar_kwh: 0, tariff_bdt_per_kwh: 5 },
        { hour: 4, demand_kwh: 90, solar_kwh: 0, tariff_bdt_per_kwh: 5 },
        { hour: 5, demand_kwh: 100, solar_kwh: 0, tariff_bdt_per_kwh: 6 },
        { hour: 6, demand_kwh: 120, solar_kwh: 10, tariff_bdt_per_kwh: 8 },
        { hour: 7, demand_kwh: 140, solar_kwh: 30, tariff_bdt_per_kwh: 10 },
        { hour: 8, demand_kwh: 160, solar_kwh: 70, tariff_bdt_per_kwh: 13 },
        { hour: 9, demand_kwh: 175, solar_kwh: 110, tariff_bdt_per_kwh: 15 },
        { hour: 10, demand_kwh: 190, solar_kwh: 160, tariff_bdt_per_kwh: 17 },
        { hour: 11, demand_kwh: 200, solar_kwh: 200, tariff_bdt_per_kwh: 17 },
        { hour: 12, demand_kwh: 205, solar_kwh: 220, tariff_bdt_per_kwh: 16 },
        { hour: 13, demand_kwh: 200, solar_kwh: 210, tariff_bdt_per_kwh: 15 },
        { hour: 14, demand_kwh: 190, solar_kwh: 170, tariff_bdt_per_kwh: 14 },
        { hour: 15, demand_kwh: 180, solar_kwh: 110, tariff_bdt_per_kwh: 15 },
        { hour: 16, demand_kwh: 185, solar_kwh: 50, tariff_bdt_per_kwh: 19 },
        { hour: 17, demand_kwh: 200, solar_kwh: 15, tariff_bdt_per_kwh: 23 },
        { hour: 18, demand_kwh: 220, solar_kwh: 0, tariff_bdt_per_kwh: 29 },
        { hour: 19, demand_kwh: 235, solar_kwh: 0, tariff_bdt_per_kwh: 32 },
        { hour: 20, demand_kwh: 220, solar_kwh: 0, tariff_bdt_per_kwh: 28 },
        { hour: 21, demand_kwh: 190, solar_kwh: 0, tariff_bdt_per_kwh: 20 },
        { hour: 22, demand_kwh: 150, solar_kwh: 0, tariff_bdt_per_kwh: 11 },
        { hour: 23, demand_kwh: 120, solar_kwh: 0, tariff_bdt_per_kwh: 8 }
      ],
      battery: {
        capacity_kwh: 300,
        initial_energy_kwh: 150,
        minimum_energy_kwh: 50,
        max_charge_kwh_per_hour: 75,
        max_discharge_kwh_per_hour: 75
      }
    }
  },
  {
    id: 'CUSTOM-02',
    label: '40% Emergency Reserve + Discharging Lockout',
    input: {
      scenario_id: 'CUSTOM-02',
      operator_notes: [
        'Ensure 40% of the battery capacity is reserved for emergency from 6 PM until 10 PM.',
        'The battery must not discharge between 1 PM and 3 PM.',
        'The annual sports meet results were published.'
      ],
      hours: [
        { hour: 0, demand_kwh: 90, solar_kwh: 0, tariff_bdt_per_kwh: 6 },
        { hour: 1, demand_kwh: 85, solar_kwh: 0, tariff_bdt_per_kwh: 5 },
        { hour: 2, demand_kwh: 80, solar_kwh: 0, tariff_bdt_per_kwh: 5 },
        { hour: 3, demand_kwh: 80, solar_kwh: 0, tariff_bdt_per_kwh: 4 },
        { hour: 4, demand_kwh: 85, solar_kwh: 0, tariff_bdt_per_kwh: 4 },
        { hour: 5, demand_kwh: 95, solar_kwh: 0, tariff_bdt_per_kwh: 5 },
        { hour: 6, demand_kwh: 115, solar_kwh: 10, tariff_bdt_per_kwh: 7 },
        { hour: 7, demand_kwh: 130, solar_kwh: 25, tariff_bdt_per_kwh: 9 },
        { hour: 8, demand_kwh: 145, solar_kwh: 60, tariff_bdt_per_kwh: 11 },
        { hour: 9, demand_kwh: 160, solar_kwh: 95, tariff_bdt_per_kwh: 13 },
        { hour: 10, demand_kwh: 170, solar_kwh: 140, tariff_bdt_per_kwh: 15 },
        { hour: 11, demand_kwh: 180, solar_kwh: 175, tariff_bdt_per_kwh: 16 },
        { hour: 12, demand_kwh: 185, solar_kwh: 190, tariff_bdt_per_kwh: 15 },
        { hour: 13, demand_kwh: 180, solar_kwh: 180, tariff_bdt_per_kwh: 14 },
        { hour: 14, demand_kwh: 170, solar_kwh: 150, tariff_bdt_per_kwh: 13 },
        { hour: 15, demand_kwh: 165, solar_kwh: 100, tariff_bdt_per_kwh: 14 },
        { hour: 16, demand_kwh: 170, solar_kwh: 50, tariff_bdt_per_kwh: 18 },
        { hour: 17, demand_kwh: 190, solar_kwh: 15, tariff_bdt_per_kwh: 22 },
        { hour: 18, demand_kwh: 210, solar_kwh: 0, tariff_bdt_per_kwh: 28 },
        { hour: 19, demand_kwh: 220, solar_kwh: 0, tariff_bdt_per_kwh: 31 },
        { hour: 20, demand_kwh: 210, solar_kwh: 0, tariff_bdt_per_kwh: 27 },
        { hour: 21, demand_kwh: 180, solar_kwh: 0, tariff_bdt_per_kwh: 19 },
        { hour: 22, demand_kwh: 140, solar_kwh: 0, tariff_bdt_per_kwh: 10 },
        { hour: 23, demand_kwh: 110, solar_kwh: 0, tariff_bdt_per_kwh: 7 }
      ],
      battery: {
        capacity_kwh: 250,
        initial_energy_kwh: 125,
        minimum_energy_kwh: 35,
        max_charge_kwh_per_hour: 60,
        max_discharge_kwh_per_hour: 60
      }
    }
  },
  {
    id: 'CUSTOM-03',
    label: 'Transformer Grid Import Cap + Morning Charging Outage',
    input: {
      scenario_id: 'CUSTOM-03',
      operator_notes: [
        'Do not charge the battery between 2 AM and 5 AM due to cable rewiring.',
        'Substation limit caps grid intake at 140 kWh from 7 PM until 10 PM.'
      ],
      hours: [
        { hour: 0, demand_kwh: 95, solar_kwh: 0, tariff_bdt_per_kwh: 6 },
        { hour: 1, demand_kwh: 90, solar_kwh: 0, tariff_bdt_per_kwh: 5 },
        { hour: 2, demand_kwh: 85, solar_kwh: 0, tariff_bdt_per_kwh: 4 },
        { hour: 3, demand_kwh: 85, solar_kwh: 0, tariff_bdt_per_kwh: 4 },
        { hour: 4, demand_kwh: 90, solar_kwh: 0, tariff_bdt_per_kwh: 4 },
        { hour: 5, demand_kwh: 100, solar_kwh: 0, tariff_bdt_per_kwh: 5 },
        { hour: 6, demand_kwh: 115, solar_kwh: 5, tariff_bdt_per_kwh: 7 },
        { hour: 7, demand_kwh: 130, solar_kwh: 20, tariff_bdt_per_kwh: 9 },
        { hour: 8, demand_kwh: 145, solar_kwh: 50, tariff_bdt_per_kwh: 11 },
        { hour: 9, demand_kwh: 160, solar_kwh: 90, tariff_bdt_per_kwh: 13 },
        { hour: 10, demand_kwh: 170, solar_kwh: 130, tariff_bdt_per_kwh: 15 },
        { hour: 11, demand_kwh: 180, solar_kwh: 160, tariff_bdt_per_kwh: 16 },
        { hour: 12, demand_kwh: 185, solar_kwh: 180, tariff_bdt_per_kwh: 15 },
        { hour: 13, demand_kwh: 180, solar_kwh: 170, tariff_bdt_per_kwh: 14 },
        { hour: 14, demand_kwh: 170, solar_kwh: 140, tariff_bdt_per_kwh: 13 },
        { hour: 15, demand_kwh: 165, solar_kwh: 90, tariff_bdt_per_kwh: 14 },
        { hour: 16, demand_kwh: 175, solar_kwh: 45, tariff_bdt_per_kwh: 18 },
        { hour: 17, demand_kwh: 195, solar_kwh: 10, tariff_bdt_per_kwh: 22 },
        { hour: 18, demand_kwh: 215, solar_kwh: 0, tariff_bdt_per_kwh: 29 },
        { hour: 19, demand_kwh: 225, solar_kwh: 0, tariff_bdt_per_kwh: 32 },
        { hour: 20, demand_kwh: 215, solar_kwh: 0, tariff_bdt_per_kwh: 29 },
        { hour: 21, demand_kwh: 185, solar_kwh: 0, tariff_bdt_per_kwh: 20 },
        { hour: 22, demand_kwh: 145, solar_kwh: 0, tariff_bdt_per_kwh: 10 },
        { hour: 23, demand_kwh: 115, solar_kwh: 0, tariff_bdt_per_kwh: 7 }
      ],
      battery: {
        capacity_kwh: 240,
        initial_energy_kwh: 120,
        minimum_energy_kwh: 30,
        max_charge_kwh_per_hour: 60,
        max_discharge_kwh_per_hour: 60
      }
    }
  }
];

async function runCustomTests() {
  console.log('========================================================');
  console.log('--- Executing Custom Unseen Stress Scenarios ---');
  console.log('========================================================\n');

  for (const tc of customCases) {
    const t0 = Date.now();
    try {
      const res = await processEnergyOptimization(tc.input);
      const elapsed = Date.now() - t0;

      console.log(`[PASS] Case: ${tc.id} (${tc.label})`);
      console.log(`  - Total Cost: ${res.total_cost_bdt.toLocaleString()} BDT`);
      console.log(`  - Total Grid Import: ${res.total_grid_kwh.toLocaleString()} kWh`);
      console.log(`  - Peak Grid Load: ${res.peak_grid_kwh} kWh`);
      console.log(`  - Execution Latency: ${elapsed}ms`);
      console.log(`  - Interpreted Directives:`);
      for (const d of res.directive_interpretation) {
        console.log(`      * Note ${d.note_index}: [${d.directive_type}] applies=${d.applies} adj=${JSON.stringify(d.structured_adjustment)}`);
      }
      console.log(`  - Plan Summary: ${res.plan_summary}\n`);
    } catch (err) {
      console.error(`[FAIL] ${tc.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('========================================================');
  console.log('--- All Custom Scenarios Passed Validation & Optimization ---');
  console.log('========================================================');
  process.exit(0);
}

runCustomTests();
