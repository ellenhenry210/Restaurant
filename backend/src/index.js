import express from 'express';
import dotenv from 'dotenv';

import { generalLimiter } from './middleware/rateLimit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Applied before express.json() so an over-limit request is rejected
// cheaply, without paying the cost of parsing its body first.
app.use(generalLimiter);

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ message: 'SnapOrder API', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});