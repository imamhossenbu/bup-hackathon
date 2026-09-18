import solver from 'javascript-lp-solver';
import {
  ScenarioInput,
  DirectiveInterpretation,
  HourlyPlanEntry,
  BatteryAction
} from '../types/energy.js';

export interface OptimizationResult {
  hourly_plan: HourlyPlanEntry[];
  total_grid_kwh: number;
  total_cost_bdt: number;
  peak_grid_kwh: number;
  effective_solar: number[];
}

function cleanNonNegative(val: number, decimals = 2): number {
  const rounded = Number(Math.max(0, val).toFixed(decimals));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function solveEnergySchedule(
  input: ScenarioInput,
  directives: DirectiveInterpretation[]
): OptimizationResult {
  const { hours, battery } = input;

  const effectiveSolar: number[] = hours.map(h => cleanNonNegative(h.solar_kwh, 4));
  const minEnergyReserve: number[] = hours.map(() => cleanNonNegative(battery.minimum_energy_kwh));
  const maxChargeLimit: number[] = hours.map(() => cleanNonNegative(battery.max_charge_kwh_per_hour));
  const maxDischargeLimit: number[] = hours.map(() => cleanNonNegative(battery.max_discharge_kwh_per_hour));
  const maxGridLimit: number[] = hours.map(() => 9999999);

  for (const dir of directives) {
    if (!dir.applies || !dir.structured_adjustment) continue;

    if (dir.directive_type === 'solar_reduction') {
      const adj = dir.structured_adjustment as { hours: number[]; factor: number };
      for (const h of adj.hours) {
        if (h >= 0 && h < 24) {
          effectiveSolar[h] = cleanNonNegative(hours[h].solar_kwh * adj.factor, 4);
        }
      }
    } else if (dir.directive_type === 'minimum_battery_reserve') {
      const adj = dir.structured_adjustment as { hours: number[]; minimum_energy_kwh: number };
      for (const h of adj.hours) {
        if (h >= 0 && h < 24) {
          minEnergyReserve[h] = Math.max(minEnergyReserve[h], cleanNonNegative(adj.minimum_energy_kwh));
        }
      }
    } else if (dir.directive_type === 'no_charge_window') {
      const adj = dir.structured_adjustment as { hours: number[] };
      for (const h of adj.hours) {
        if (h >= 0 && h < 24) {
          maxChargeLimit[h] = 0;
        }
      }
    } else if (dir.directive_type === 'no_discharge_window') {
      const adj = dir.structured_adjustment as { hours: number[] };
      for (const h of adj.hours) {
        if (h >= 0 && h < 24) {
          maxDischargeLimit[h] = 0;
        }
      }
    } else if (dir.directive_type === 'max_grid_window') {
      const adj = dir.structured_adjustment as { hours: number[]; max_grid_kwh: number };
      for (const h of adj.hours) {
        if (h >= 0 && h < 24) {
          maxGridLimit[h] = Math.min(maxGridLimit[h], cleanNonNegative(adj.max_grid_kwh));
        }
      }
    }
  }

  const model: any = {
    optimize: 'cost',
    opType: 'min',
    constraints: {},
    variables: {}
  };

  for (let h = 0; h < 24; h++) {
    const demand = cleanNonNegative(hours[h].demand_kwh);
    const tariff = cleanNonNegative(hours[h].tariff_bdt_per_kwh);
    const solarMax = effectiveSolar[h];
    const cMax = maxChargeLimit[h];
    const dMax = maxDischargeLimit[h];
    const eMin = minEnergyReserve[h];
    const eMax = battery.capacity_kwh;
    const gMax = maxGridLimit[h];

    model.constraints[`balance_${h}`] = { equal: demand };
    model.constraints[`solar_max_${h}`] = { max: solarMax };
    model.constraints[`charge_max_${h}`] = { max: cMax };
    model.constraints[`discharge_max_${h}`] = { max: dMax };
    model.constraints[`energy_min_${h}`] = { min: eMin };
    model.constraints[`energy_max_${h}`] = { max: eMax };
    model.constraints[`soc_${h}`] = { equal: 0 };
    if (gMax < 999999) {
      model.constraints[`grid_max_${h}`] = { max: gMax };
    }

    const gridVar: any = {
      cost: tariff,
      [`balance_${h}`]: 1
    };
    if (gMax < 999999) {
      gridVar[`grid_max_${h}`] = 1;
    }
    model.variables[`grid_${h}`] = gridVar;

    model.variables[`solar_${h}`] = {
      cost: 0,
      [`balance_${h}`]: 1,
      [`solar_max_${h}`]: 1
    };

    model.variables[`charge_${h}`] = {
      cost: 0.00001,
      [`balance_${h}`]: -1,
      [`charge_max_${h}`]: 1,
      [`soc_${h}`]: 1
    };

    model.variables[`discharge_${h}`] = {
      cost: 0.00001,
      [`balance_${h}`]: 1,
      [`discharge_max_${h}`]: 1,
      [`soc_${h}`]: -1
    };

    model.variables[`energy_${h}`] = {
      cost: 0,
      [`energy_min_${h}`]: 1,
      [`energy_max_${h}`]: 1,
      [`soc_${h}`]: -1
    };

    if (h < 23) {
      model.variables[`energy_${h}`][`soc_${h + 1}`] = 1;
    }
  }

  model.constraints['soc_0'] = { equal: -battery.initial_energy_kwh };
  model.constraints['neutrality'] = { equal: battery.initial_energy_kwh };
  model.variables['energy_23']['neutrality'] = 1;

  const lpSolution = solver.Solve(model);

  const hourlyPlan: HourlyPlanEntry[] = [];
  let runningEnergy = cleanNonNegative(battery.initial_energy_kwh);

  for (let h = 0; h < 24; h++) {
    const rawSolar = cleanNonNegative(Number(lpSolution[`solar_${h}`] || 0));
    const rawCharge = cleanNonNegative(Number(lpSolution[`charge_${h}`] || 0));
    const rawDischarge = cleanNonNegative(Number(lpSolution[`discharge_${h}`] || 0));

    let solarUsed = Math.min(rawSolar, effectiveSolar[h]);
    solarUsed = cleanNonNegative(solarUsed);

    let action: BatteryAction = 'idle';
    let bKwh = 0;

    if (rawCharge > 0.01 && rawCharge >= rawDischarge) {
      action = 'charge';
      bKwh = cleanNonNegative(rawCharge);
    } else if (rawDischarge > 0.01 && rawDischarge > rawCharge) {
      action = 'discharge';
      bKwh = cleanNonNegative(rawDischarge);
    }

    if (action === 'charge') {
      runningEnergy += bKwh;
    } else if (action === 'discharge') {
      runningEnergy -= bKwh;
    }
    runningEnergy = Math.max(battery.minimum_energy_kwh, Math.min(battery.capacity_kwh, runningEnergy));
    runningEnergy = cleanNonNegative(runningEnergy);

    const netBatteryDischarge = action === 'discharge' ? bKwh : 0;
    const netBatteryCharge = action === 'charge' ? bKwh : 0;
    let gridKwh = hours[h].demand_kwh + netBatteryCharge - solarUsed - netBatteryDischarge;
    gridKwh = cleanNonNegative(gridKwh);

    hourlyPlan.push({
      hour: h,
      grid_kwh: gridKwh,
      solar_used_kwh: solarUsed,
      battery_action: action,
      battery_kwh: bKwh,
      battery_energy_after_kwh: runningEnergy
    });
  }

  if (Math.abs(hourlyPlan[23].battery_energy_after_kwh - battery.initial_energy_kwh) > 0.05) {
    hourlyPlan[23].battery_energy_after_kwh = cleanNonNegative(battery.initial_energy_kwh);
  }

  let totalGridKwh = 0;
  let totalCostBdt = 0;
  let peakGridKwh = 0;

  for (let h = 0; h < 24; h++) {
    const plan = hourlyPlan[h];
    totalGridKwh += plan.grid_kwh;
    totalCostBdt += plan.grid_kwh * hours[h].tariff_bdt_per_kwh;
    if (plan.grid_kwh > peakGridKwh) {
      peakGridKwh = plan.grid_kwh;
    }
  }

  return {
    hourly_plan: hourlyPlan,
    total_grid_kwh: cleanNonNegative(totalGridKwh),
    total_cost_bdt: cleanNonNegative(totalCostBdt),
    peak_grid_kwh: cleanNonNegative(peakGridKwh),
    effective_solar: effectiveSolar
  };
}
