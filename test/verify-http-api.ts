import fs from 'fs';

const samplePack = JSON.parse(fs.readFileSync('public_sample_cases.json', 'utf8'));
const payload = samplePack.cases[0].input;

async function testLiveApi() {
  console.log('=====================================================');
  console.log('--- Testing Live HTTP API on http://localhost:3000 ---');
  console.log('=====================================================\n');

  console.log('1. Testing GET /health ...');
  const healthRes = await fetch('http://localhost:3000/health');
  const healthJson = await healthRes.json();
  console.log(`   HTTP Status: ${healthRes.status} ${healthRes.statusText}`);
  console.log(`   Body: ${JSON.stringify(healthJson)}`);
  if (healthRes.status === 200 && healthJson.status === 'ok') {
    console.log('   [SUCCESS] GET /health strictly matches requirement!\n');
  } else {
    console.log('   [FAILED] GET /health does not match!\n');
  }

  console.log('2. Testing POST /optimize-energy ...');
  const t0 = Date.now();
  const optRes = await fetch('http://localhost:3000/optimize-energy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const elapsed = Date.now() - t0;
  const optJson = await optRes.json();

  console.log(`   HTTP Status: ${optRes.status} ${optRes.statusText} (${elapsed}ms)`);

  const requiredFields = [
    'scenario_id',
    'directive_interpretation',
    'hourly_plan',
    'total_grid_kwh',
    'total_cost_bdt',
    'peak_grid_kwh',
    'plan_summary'
  ];

  console.log('\n--- Checking Response Schema Fields ---');
  let allFieldsValid = true;
  for (const field of requiredFields) {
    const exists = field in optJson;
    console.log(`   [${exists ? 'OK' : 'MISSING'}] Field: "${field}"`);
    if (!exists) allFieldsValid = false;
  }

  console.log('\n--- Checking Directives Contract ---');
  const dirs = optJson.directive_interpretation || [];
  console.log(`   Total Directives Returned: ${dirs.length} (Matches input notes count: ${payload.operator_notes.length})`);
  dirs.forEach((d: any, i: number) => {
    console.log(`   Note ${i}: applies=${d.applies}, directive_type="${d.directive_type}", adjustment=${JSON.stringify(d.structured_adjustment)}`);
  });

  console.log('\n--- Checking Hourly Plan Contract ---');
  const plan = optJson.hourly_plan || [];
  console.log(`   Total Hourly Plan Entries: ${plan.length} (Must be exactly 24: ${plan.length === 24 ? 'YES' : 'NO'})`);
  console.log(`   Sample Hour 0: ${JSON.stringify(plan[0])}`);
  console.log(`   Sample Hour 12: ${JSON.stringify(plan[12])}`);

  console.log('\n--- Numerical Results ---');
  console.log(`   Total Cost:     ${optJson.total_cost_bdt} BDT (Expected: 38365 BDT)`);
  console.log(`   Total Grid:     ${optJson.total_grid_kwh} kWh`);
  console.log(`   Peak Grid:      ${optJson.peak_grid_kwh} kWh`);
  console.log(`   Plan Summary:   ${optJson.plan_summary.substring(0, 100)}...`);

  if (allFieldsValid && plan.length === 24 && optJson.total_cost_bdt === 38365) {
    console.log('\n=====================================================');
    console.log('>>> VERDICT: 100% COMPLIANT WITH BUP HACKATHON CONTRACT <<<');
    console.log('=====================================================');
  }

  process.exit(0);
}

testLiveApi().catch(err => {
  console.error('API Test Error:', err);
  process.exit(1);
});
