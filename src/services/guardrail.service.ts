import {
  DirectiveInterpretation,
  DirectiveType,
  BatteryConfig
} from '../types/energy.js';

const ALLOWED_DIRECTIVE_TYPES: DirectiveType[] = [
  'solar_reduction',
  'minimum_battery_reserve',
  'no_charge_window',
  'no_discharge_window',
  'max_grid_window',
  'no_op'
];

export function sanitizeHours(hours: any): number[] {
  if (!Array.isArray(hours)) return [];
  const valid = hours
    .map(h => Number(h))
    .filter(h => Number.isInteger(h) && h >= 0 && h <= 23);
  return Array.from(new Set(valid)).sort((a, b) => a - b);
}

export function validateAndRepairDirectiveInterpretation(
  rawInterpretations: any[],
  operatorNotes: string[],
  battery: BatteryConfig
): DirectiveInterpretation[] {
  const result: DirectiveInterpretation[] = [];

  for (let i = 0; i < operatorNotes.length; i++) {
    const raw = rawInterpretations?.find((item: any) => item?.note_index === i) || rawInterpretations?.[i];

    if (!raw) {
      result.push({
        note_index: i,
        applies: false,
        directive_type: 'no_op',
        structured_adjustment: null,
        explanation: 'Default fallback for missing interpretation'
      });
      continue;
    }

    let directiveType: DirectiveType = 'no_op';
    if (ALLOWED_DIRECTIVE_TYPES.includes(raw.directive_type)) {
      directiveType = raw.directive_type;
    }

    let applies = Boolean(raw.applies);
    if (directiveType === 'no_op') {
      applies = false;
    } else {
      applies = true;
    }

    let explanation = typeof raw.explanation === 'string' && raw.explanation.trim().length > 0
      ? raw.explanation.trim()
      : applies ? `Applied ${directiveType}` : 'This note does not affect the energy schedule';

    let structuredAdjustment: any = null;

    if (!applies || directiveType === 'no_op') {
      applies = false;
      directiveType = 'no_op';
      structuredAdjustment = null;
    } else {
      const rawAdj = raw.structured_adjustment || {};
      const hours = sanitizeHours(rawAdj.hours);

      if (directiveType === 'solar_reduction') {
        let factor = Number(rawAdj.factor);
        if (isNaN(factor) || factor < 0) factor = 1.0;
        if (factor > 1 && factor <= 100) factor = factor / 100;
        factor = Math.max(0, Math.min(1, factor));
        structuredAdjustment = {
          hours,
          factor: Number(factor.toFixed(4))
        };
      } else if (directiveType === 'minimum_battery_reserve') {
        let minEnergy = Number(rawAdj.minimum_energy_kwh);
        if (isNaN(minEnergy) || minEnergy < 0) minEnergy = battery.minimum_energy_kwh;
        minEnergy = Math.min(minEnergy, battery.capacity_kwh);
        structuredAdjustment = {
          hours,
          minimum_energy_kwh: Number(minEnergy.toFixed(2))
        };
      } else if (directiveType === 'no_charge_window') {
        structuredAdjustment = {
          hours
        };
      } else if (directiveType === 'no_discharge_window') {
        structuredAdjustment = {
          hours
        };
      } else if (directiveType === 'max_grid_window') {
        let maxGrid = Number(rawAdj.max_grid_kwh);
        if (isNaN(maxGrid) || maxGrid < 0) maxGrid = 999999;
        structuredAdjustment = {
          hours,
          max_grid_kwh: Number(maxGrid.toFixed(2))
        };
      }
    }

    result.push({
      note_index: i,
      applies,
      directive_type: directiveType,
      structured_adjustment: structuredAdjustment,
      explanation
    });
  }

  return result.sort((a, b) => a.note_index - b.note_index);
}
