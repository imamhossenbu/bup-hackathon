import { ScenarioInput, DirectiveInterpretation, HourlyPlanEntry } from '../types/energy.js';

export interface AuditResult {
  isValid: boolean;
  violations: string[];
}

export function auditSchedule(
  input: ScenarioInput,
  directives: DirectiveInterpretation[],
  hourlyPlan: HourlyPlanEntry[],
  effectiveSolar: number[]
): AuditResult {
  const violations: string[] = [];
  const { hours, battery } = input;

  let simulatedEnergy = battery.initial_energy_kwh;

  for (let h = 0; h < 24; h++) {
    const entry = hourlyPlan[h];
    const hourData = hours[h];
    const effSolar = effectiveSolar[h];

    if (entry.solar_used_kwh > effSolar + 0.01) {
      violations.push(`Hour ${h}: solar_used_kwh (${entry.solar_used_kwh}) exceeds effective solar (${effSolar})`);
    }

    const chargeKwh = entry.battery_action === 'charge' ? entry.battery_kwh : 0;
    const dischargeKwh = entry.battery_action === 'discharge' ? entry.battery_kwh : 0;

    if (chargeKwh > battery.max_charge_kwh_per_hour + 0.01) {
      violations.push(`Hour ${h}: charge rate exceeds maximum allowable rate`);
    }
    if (dischargeKwh > battery.max_discharge_kwh_per_hour + 0.01) {
      violations.push(`Hour ${h}: discharge rate exceeds maximum allowable rate`);
    }

    const supplied = entry.grid_kwh + entry.solar_used_kwh + dischargeKwh;
    const demanded = hourData.demand_kwh + chargeKwh;
    if (Math.abs(supplied - demanded) > 0.05) {
      violations.push(`Hour ${h}: Energy balance violation (${supplied} != ${demanded})`);
    }

    if (entry.battery_action === 'charge') {
      simulatedEnergy += entry.battery_kwh;
    } else if (entry.battery_action === 'discharge') {
      simulatedEnergy -= entry.battery_kwh;
    }

    if (Math.abs(simulatedEnergy - entry.battery_energy_after_kwh) > 0.05) {
      violations.push(`Hour ${h}: Battery state mismatch`);
    }

    if (simulatedEnergy < battery.minimum_energy_kwh - 0.01 || simulatedEnergy > battery.capacity_kwh + 0.01) {
      violations.push(`Hour ${h}: Battery energy out of physical bounds`);
    }

    for (const dir of directives) {
      if (!dir.applies || !dir.structured_adjustment) continue;

      if (dir.directive_type === 'no_charge_window') {
        const adj = dir.structured_adjustment as { hours: number[] };
        if (adj.hours.includes(h) && entry.battery_action === 'charge' && entry.battery_kwh > 0.01) {
          violations.push(`Hour ${h}: Violated no_charge_window`);
        }
      } else if (dir.directive_type === 'no_discharge_window') {
        const adj = dir.structured_adjustment as { hours: number[] };
        if (adj.hours.includes(h) && entry.battery_action === 'discharge' && entry.battery_kwh > 0.01) {
          violations.push(`Hour ${h}: Violated no_discharge_window`);
        }
      } else if (dir.directive_type === 'minimum_battery_reserve') {
        const adj = dir.structured_adjustment as { hours: number[]; minimum_energy_kwh: number };
        if (adj.hours.includes(h) && entry.battery_energy_after_kwh < adj.minimum_energy_kwh - 0.01) {
          violations.push(`Hour ${h}: Violated minimum_battery_reserve (${entry.battery_energy_after_kwh} < ${adj.minimum_energy_kwh})`);
        }
      } else if (dir.directive_type === 'max_grid_window') {
        const adj = dir.structured_adjustment as { hours: number[]; max_grid_kwh: number };
        if (adj.hours.includes(h) && entry.grid_kwh > adj.max_grid_kwh + 0.01) {
          violations.push(`Hour ${h}: Violated max_grid_window (${entry.grid_kwh} > ${adj.max_grid_kwh})`);
        }
      }
    }
  }

  if (Math.abs(hourlyPlan[23].battery_energy_after_kwh - battery.initial_energy_kwh) > 0.05) {
    violations.push('End-of-day battery energy neutrality not satisfied');
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}
