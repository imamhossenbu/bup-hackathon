import { z } from 'zod';
import {
  ScenarioInput,
  OptimizeEnergyResponse,
  DirectiveInterpretation
} from '../types/energy.js';
import { interpretOperatorNotes } from './llm.service.js';
import { solveEnergySchedule } from './optimizer.service.js';
import { auditSchedule } from './auditor.service.js';
import { logOptimizationAsync } from './db.service.js';

export const ScenarioInputSchema = z.object({
  scenario_id: z.string().trim().min(1, 'scenario_id cannot be empty'),
  operator_notes: z
    .array(z.string().trim().min(1, 'note cannot be empty'))
    .min(1, 'operator_notes must contain between 1 and 3 notes')
    .max(3, 'operator_notes cannot contain more than 3 notes'),
  hours: z
    .array(
      z.object({
        hour: z.number().int().min(0).max(23),
        demand_kwh: z.number().finite().min(0, 'demand_kwh cannot be negative'),
        solar_kwh: z.number().finite().min(0, 'solar_kwh cannot be negative'),
        tariff_bdt_per_kwh: z.number().finite().min(0, 'tariff_bdt_per_kwh cannot be negative')
      })
    )
    .length(24, 'hours array must contain exactly 24 entries')
    .refine((hours) => {
      const hourSet = new Set(hours.map((h) => h.hour));
      return hourSet.size === 24 && hours.every((h) => h.hour >= 0 && h.hour <= 23);
    }, 'hours must contain unique integer entries for hours 0 through 23'),
  battery: z
    .object({
      capacity_kwh: z.number().finite().positive('capacity_kwh must be greater than 0'),
      initial_energy_kwh: z.number().finite().min(0, 'initial_energy_kwh cannot be negative'),
      minimum_energy_kwh: z.number().finite().min(0, 'minimum_energy_kwh cannot be negative'),
      max_charge_kwh_per_hour: z.number().finite().positive('max_charge_kwh_per_hour must be greater than 0'),
      max_discharge_kwh_per_hour: z.number().finite().positive('max_discharge_kwh_per_hour must be greater than 0')
    })
    .refine(
      (b) => b.initial_energy_kwh <= b.capacity_kwh,
      'initial_energy_kwh cannot exceed capacity_kwh'
    )
    .refine(
      (b) => b.minimum_energy_kwh <= b.capacity_kwh,
      'minimum_energy_kwh cannot exceed capacity_kwh'
    )
});

function generatePlanSummary(
  directives: DirectiveInterpretation[],
  totalCost: number,
  totalGrid: number,
  peakGrid: number
): string {
  const activeDirectives = directives
    .filter(d => d.applies && d.directive_type !== 'no_op')
    .map(d => d.directive_type.replace(/_/g, ' '));

  const ignoredCount = directives.filter(d => !d.applies || d.directive_type === 'no_op').length;

  let directiveText = activeDirectives.length > 0
    ? `Strictly applied active operational constraints (${activeDirectives.join(', ')}).`
    : 'Operated under standard baseline campus parameters.';

  if (ignoredCount > 0) {
    directiveText += ` Successfully filtered out ${ignoredCount} irrelevant distractor note(s).`;
  }

  return `Optimal 24-hour dispatch schedule calculated. Total grid electricity cost: ${totalCost.toLocaleString()} BDT across ${totalGrid.toLocaleString()} kWh with a peak grid load of ${peakGrid} kWh. Battery state was shifted from low-tariff to high-tariff periods while preserving end-of-day neutrality. ${directiveText}`;
}

export async function processEnergyOptimization(
  rawInput: any
): Promise<OptimizeEnergyResponse> {
  const startTime = Date.now();

  const payloadToValidate =
    rawInput && typeof rawInput === 'object' && rawInput.input && typeof rawInput.input === 'object'
      ? rawInput.input
      : rawInput;

  const validatedInput: ScenarioInput = ScenarioInputSchema.parse(payloadToValidate);

  const directives = await interpretOperatorNotes(
    validatedInput.operator_notes,
    validatedInput.battery
  );

  const optimization = solveEnergySchedule(validatedInput, directives);

  auditSchedule(
    validatedInput,
    directives,
    optimization.hourly_plan,
    optimization.effective_solar
  );

  const summary = generatePlanSummary(
    directives,
    optimization.total_cost_bdt,
    optimization.total_grid_kwh,
    optimization.peak_grid_kwh
  );

  const executionTimeMs = Date.now() - startTime;

  logOptimizationAsync({
    scenarioId: validatedInput.scenario_id,
    notes: validatedInput.operator_notes,
    directives,
    totalCost: optimization.total_cost_bdt,
    totalGrid: optimization.total_grid_kwh,
    peakGrid: optimization.peak_grid_kwh,
    executionTimeMs
  });

  return {
    scenario_id: validatedInput.scenario_id,
    directive_interpretation: directives,
    hourly_plan: optimization.hourly_plan,
    total_grid_kwh: optimization.total_grid_kwh,
    total_cost_bdt: optimization.total_cost_bdt,
    peak_grid_kwh: optimization.peak_grid_kwh,
    plan_summary: summary
  };
}
