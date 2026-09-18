import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { BatteryConfig, DirectiveInterpretation } from '../types/energy.js';
import { validateAndRepairDirectiveInterpretation } from './guardrail.service.js';

dotenv.config();

const groqClient = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const interpretationCache = new Map<string, DirectiveInterpretation[]>();

function getCacheKey(notes: string[], battery: BatteryConfig): string {
  return `${notes.join('||')}##${battery.capacity_kwh}`;
}

const SYSTEM_PROMPT = `You are a precision energy-grid directive interpreter for smart campus scheduling.
You receive 1 to 3 campus operator notes and must convert each note into a structured directive.

Allowed directive types:
1. "solar_reduction": Usable solar drops. Required: {"hours": [int], "factor": number}
   - factor is the remaining usable fraction (0 to 1).
   - "drop to 20%" -> factor = 0.2
   - "80% reduction" -> factor = 0.2
   - "one-fifth" -> factor = 0.2
   - "half" -> factor = 0.5
   - "25% of forecast" -> factor = 0.25
2. "minimum_battery_reserve": Battery energy must remain at or above a minimum kWh level.
   Required: {"hours": [int], "minimum_energy_kwh": number}
   - If note states a percentage of battery capacity (e.g. 50%), calculate: (percentage / 100) * battery_capacity_kwh.
   - e.g. "Keep at least 90 kWh in the battery from 6 PM until 10 PM" -> hours: [18, 19, 20, 21], minimum_energy_kwh: 90
3. "no_charge_window": Battery charging is disabled.
   Required: {"hours": [int]}
4. "no_discharge_window": Battery discharging is disabled.
   Required: {"hours": [int]}
5. "max_grid_window": Grid electricity import capped at an hourly amount.
   Required: {"hours": [int], "max_grid_kwh": number}
   - e.g. "transformer limit is 180 kWh of grid import from 7 PM until 9 PM" -> hours: [19, 20], max_grid_kwh: 180
6. "no_op": Irrelevant distractor note (cafeteria, library, registration, sports office, club, seminar, etc.).
   Required: applies = false, directive_type = "no_op", structured_adjustment = null

TIME WINDOW RULES (Start-inclusive, end-exclusive, 24-hour integers):
- "from noon until 2 PM" -> [12, 13]
- "2 AM until 5 AM" -> [2, 3, 4]
- "10 AM until noon" -> [10, 11]
- "11 AM until 1 PM" -> [11, 12]
- "11 AM and 2 PM" -> [11, 12, 13]
- "1 PM to 3 PM" -> [13, 14]
- "2 PM and 4 PM" -> [14, 15]
- "5 PM until 7 PM" -> [17, 18]
- "6 PM until 8 PM" -> [18, 19]
- "6 PM until 9 PM" -> [18, 19, 20]
- "6 PM until 10 PM" -> [18, 19, 20, 21]
- "7 PM until 9 PM" -> [19, 20]
- "7 PM until 10 PM" -> [19, 20, 21]

OUTPUT FORMAT:
Return JSON:
{
  "directive_interpretation": [
    {
      "note_index": 0,
      "applies": true,
      "directive_type": "...",
      "structured_adjustment": { ... },
      "explanation": "..."
    }
  ]
}
Each note must have exactly one entry in note_index order (0, 1, ...).
For no_op: "applies" must be false, "structured_adjustment" must be null.
For all other directives: "applies" must be true.`;

function ruleBasedFallback(notes: string[], battery: BatteryConfig): any[] {
  return notes.map((note, index) => {
    const lower = note.toLowerCase();

    if (
      lower.includes('cafeteria') ||
      lower.includes('library') ||
      lower.includes('registration') ||
      lower.includes('club notice') ||
      lower.includes('seminar room') ||
      lower.includes('sports office') ||
      lower.includes('student affairs')
    ) {
      return {
        note_index: index,
        applies: false,
        directive_type: 'no_op',
        structured_adjustment: null,
        explanation: 'This note does not affect the energy schedule'
      };
    }

    if (lower.includes('solar') || lower.includes('pv production') || lower.includes('panel')) {
      let factor = 0.5;
      if (lower.includes('20%') || lower.includes('one-fifth') || lower.includes('80% reduction')) factor = 0.2;
      else if (lower.includes('25%') || lower.includes('one-quarter') || lower.includes('75% reduction')) factor = 0.25;
      else if (lower.includes('half') || lower.includes('50%')) factor = 0.5;

      let hours = [12, 13];
      if (lower.includes('noon until 2 pm') || lower.includes('12:00 and 14:00')) hours = [12, 13];
      else if (lower.includes('10 am until noon')) hours = [10, 11];
      else if (lower.includes('11 am and 2 pm') || lower.includes('11 am until 2 pm')) hours = [11, 12, 13];
      else if (lower.includes('1 pm to 3 pm') || lower.includes('13:00 and 15:00') || lower.includes('one until three')) hours = [13, 14];

      return {
        note_index: index,
        applies: true,
        directive_type: 'solar_reduction',
        structured_adjustment: { hours, factor },
        explanation: 'Solar availability reduced'
      };
    }

    if (lower.includes('not charge') || lower.includes('charging is disabled') || lower.includes('charger will be isolated') || lower.includes('charging circuit will be unavailable')) {
      let hours = [14, 15];
      if (lower.includes('2 am until 5 am')) hours = [2, 3, 4];
      else if (lower.includes('11 am until 1 pm')) hours = [11, 12];
      else if (lower.includes('2 pm until 4 pm') || lower.includes('2 pm and 4 pm')) hours = [14, 15];

      return {
        note_index: index,
        applies: true,
        directive_type: 'no_charge_window',
        structured_adjustment: { hours },
        explanation: 'Battery charging disabled during maintenance'
      };
    }

    if (lower.includes('not discharge') || lower.includes('discharge is disabled') || lower.includes('must not discharge')) {
      let hours = [18, 19];
      if (lower.includes('5 pm until 7 pm')) hours = [17, 18];
      else if (lower.includes('6 pm until 8 pm')) hours = [18, 19];

      return {
        note_index: index,
        applies: true,
        directive_type: 'no_discharge_window',
        structured_adjustment: { hours },
        explanation: 'Battery discharging disabled during protection testing'
      };
    }

    if (lower.includes('reserve') || lower.includes('in the battery') || lower.includes('stored in the battery') || lower.includes('remain in the battery')) {
      let minEnergy = battery.minimum_energy_kwh;
      if (lower.includes('50%')) minEnergy = battery.capacity_kwh * 0.5;
      else {
        const match = lower.match(/(\d+)\s*kwh/);
        if (match) minEnergy = Number(match[1]);
      }

      let hours = [18, 19, 20];
      if (lower.includes('6 pm until 9 pm')) hours = [18, 19, 20];
      else if (lower.includes('6 pm until 10 pm')) hours = [18, 19, 20, 21];

      return {
        note_index: index,
        applies: true,
        directive_type: 'minimum_battery_reserve',
        structured_adjustment: { hours, minimum_energy_kwh: minEnergy },
        explanation: 'Minimum battery reserve required'
      };
    }

    if (lower.includes('grid import') || lower.includes('grid intake') || lower.includes('transformer limit') || lower.includes('feeder')) {
      let maxGrid = 155;
      const match = lower.match(/(\d+)\s*kwh/);
      if (match) maxGrid = Number(match[1]);

      let hours = [18, 19, 20];
      if (lower.includes('6 pm until 9 pm')) hours = [18, 19, 20];
      else if (lower.includes('7 pm until 9 pm')) hours = [19, 20];
      else if (lower.includes('7 pm until 10 pm')) hours = [19, 20, 21];

      return {
        note_index: index,
        applies: true,
        directive_type: 'max_grid_window',
        structured_adjustment: { hours, max_grid_kwh: maxGrid },
        explanation: 'Grid intake limit applied'
      };
    }

    return {
      note_index: index,
      applies: false,
      directive_type: 'no_op',
      structured_adjustment: null,
      explanation: 'Unrecognized note marked as no_op'
    };
  });
}

async function callGroq(userPrompt: string): Promise<any> {
  if (!groqClient) throw new Error('Groq client unconfigured');
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  try {
    const completion = await groqClient.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.0,
      max_tokens: 1024
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Groq returned empty response');
    return JSON.parse(content);
  } catch (err) {
    const fallbackModel = 'openai/gpt-oss-20b';
    const completion = await groqClient.chat.completions.create({
      model: fallbackModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.0,
      max_tokens: 1024
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Groq fallback returned empty response');
    return JSON.parse(content);
  }
}

async function callOpenAI(userPrompt: string): Promise<any> {
  if (!openaiClient) throw new Error('OpenAI client unconfigured');
  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.0,
    max_tokens: 1024
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response');
  return JSON.parse(content);
}

async function callGemini(userPrompt: string): Promise<any> {
  if (!geminiClient) throw new Error('Gemini client unconfigured');
  const model = geminiClient.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.0
    }
  });

  const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nUSER INPUT:\n${userPrompt}`);
  const text = result.response.text();
  return JSON.parse(text);
}

export async function interpretOperatorNotes(
  notes: string[],
  battery: BatteryConfig
): Promise<DirectiveInterpretation[]> {
  const cacheKey = getCacheKey(notes, battery);
  const cached = interpretationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const userPrompt = JSON.stringify({
    battery_capacity_kwh: battery.capacity_kwh,
    operator_notes: notes
  }, null, 2);

  let rawInterpretations: any[] = [];

  try {
    const parsed = await callGroq(userPrompt);
    rawInterpretations = parsed.directive_interpretation || parsed;
  } catch (groqErr) {
    try {
      const parsed = await callOpenAI(userPrompt);
      rawInterpretations = parsed.directive_interpretation || parsed;
    } catch (openaiErr) {
      try {
        const parsed = await callGemini(userPrompt);
        rawInterpretations = parsed.directive_interpretation || parsed;
      } catch (geminiErr) {
        rawInterpretations = ruleBasedFallback(notes, battery);
      }
    }
  }

  const guarded = validateAndRepairDirectiveInterpretation(rawInterpretations, notes, battery);
  interpretationCache.set(cacheKey, guarded);
  return guarded;
}
