# GridWise — Smart Campus Energy Optimization Engine

> BUP CSE Fest 2026 Hackathon · Online Preliminary Round  
> LLM-Assisted Operator Directive Interpretation & Mathematical LP Energy Scheduler

---

## 1. Overview & Architecture

GridWise is an enterprise-grade, deterministic energy scheduling service built with Node.js, TypeScript, Groq LLM interpretation, and Linear Programming (LP). The service accepts 24-hour campus demand, solar forecast, hourly grid tariffs, and 1–3 natural language operator notes, interprets temporary operational directives, and optimizes a 24-hour schedule minimizing total grid electricity cost (`total_cost_bdt`).

### Pipeline Architecture:
1. **Request Intake & Contract Validation:** Validates schema integrity using Zod.
2. **LLM Operator-Note Interpretation:** Uses high-throughput, low-latency Groq LLM (`openai/gpt-oss-120b` / `openai/gpt-oss-20b`) to extract machine-checkable directives with start-inclusive, end-exclusive time windows.
3. **Deterministic Guardrails & Auto-Repair:** Enforces allowed directive types, deduplicates and sorts hours (`0..23` ascending), normalizes percentage solar reductions, and maps non-operational notes to `no_op` (`applies: false`, `structured_adjustment: null`).
4. **Mathematical Optimization Engine:** Formulates and solves an exact 24-hour Linear Program (Simplex) minimizing `total_cost_bdt` subject to battery bounds, hourly rate limits, energy neutrality, solar curtailment, and directive constraints.
5. **Independent Auditor & Replay Verification:** Replays the completed 24-hour schedule hour-by-hour to ensure 100% compliance before releasing the API response.
6. **Async PostgreSQL Logging:** Asynchronously writes scenario execution records to Neon PostgreSQL without adding latency to the client response.
7. **Interactive Dark Glassmorphic Dashboard:** Accessible at `/` and `/dashboard` for live visualization and video demonstration.

---

## 2. API Contract

### Health Endpoint
```http
GET /health
```
**Response (HTTP 200):**
```json
{
  "status": "ok"
}
```

### Energy Optimization Endpoint
```http
POST /optimize-energy
```

**Request Headers:**
```
Content-Type: application/json
```

**Response (HTTP 200):**
```json
{
  "scenario_id": "SAMPLE-01",
  "directive_interpretation": [
    {
      "note_index": 0,
      "applies": true,
      "directive_type": "solar_reduction",
      "structured_adjustment": {
        "hours": [12, 13],
        "factor": 0.25
      },
      "explanation": "Solar availability is reduced during the panel-cleaning window."
    },
    {
      "note_index": 1,
      "applies": false,
      "directive_type": "no_op",
      "structured_adjustment": null,
      "explanation": "This note does not affect today's 24-hour energy schedule."
    }
  ],
  "hourly_plan": [
    {
      "hour": 0,
      "grid_kwh": 90,
      "solar_used_kwh": 0,
      "battery_action": "idle",
      "battery_kwh": 0,
      "battery_energy_after_kwh": 110
    }
  ],
  "total_grid_kwh": 2692.5,
  "total_cost_bdt": 38365,
  "peak_grid_kwh": 175,
  "plan_summary": "..."
}
```

---

## 3. Environment Configuration

Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=production
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=your_postgresql_database_url_here
```

---

## 4. Local Quickstart

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x

### Installation & Run
```bash
npm install
npm run build
npm start
```

### Development Mode (with Live Reload)
```bash
npm run dev
```

---

## 5. Verification & Testing

### Automated Sample Cases Test (All 10 Public Cases)
```bash
npm run test:samples
```
*Expected Output: `--- Test Summary: 10/10 Optimal Reference Matches ---` with 0.00 difference against organizer ground truth.*

### Testing with cURL

#### Test /health:
```bash
curl -X GET http://localhost:3000/health
```

#### Test /optimize-energy:
```bash
curl -X POST http://localhost:3000/optimize-energy \
  -H "Content-Type: application/json" \
  -d @public_sample_cases.json
```

---

## 6. Docker Deployment

### Build Docker Image
```bash
docker build -t gridwise-energy-optimizer:latest .
```

### Run Docker Container
```bash
docker run -d \
  -p 3000:3000 \
  -e PORT=3000 \
  -e GROQ_API_KEY="your_groq_api_key_here" \
  -e DATABASE_URL="your_postgres_url_here" \
  --name gridwise-service \
  gridwise-energy-optimizer:latest
```

---

## 7. Interactive Visual Dashboard

Navigate to `http://localhost:3000` or `http://localhost:3000/dashboard` to access the interactive web interface:
- Paste scenario JSON or load built-in sample cases.
- View real-time KPI metrics (Total Cost, Total Grid Import, Peak Grid Load).
- Inspect parsed LLM directives and structured adjustments.
- Interactive multi-axis 24-hour chart tracking Demand, Solar, Grid, Tariff, and Battery State of Charge (SOC).

---

## 8. Third-Party Libraries & Dependencies
- `express`: Minimalist web framework
- `groq-sdk`: Ultra-fast LLM inference
- `javascript-lp-solver`: Exact Simplex Linear Programming optimization engine
- `pg`: PostgreSQL client with connection pooling
- `zod`: Schema validation
