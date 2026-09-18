import dotenv from 'dotenv';
import { app } from './app.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`GridWise Energy Optimizer service listening on http://${HOST}:${PORT}`);
  console.log(`Health endpoint: http://${HOST}:${PORT}/health`);
  console.log(`Main endpoint:   http://${HOST}:${PORT}/optimize-energy`);
  console.log(`Dashboard UI:    http://${HOST}:${PORT}/dashboard`);
});
