import express from 'express';
import dotenv from 'dotenv';

import { generalLimiter, authLimiter } from './middleware/rateLimit.js';
import { authenticate } from './middleware/auth.js';
import { initDb } from './init-db.js';
import authRoutes from './routes/auth.js';
import staffRoutes from './routes/staff.js';
import guestSessionRoutes from './routes/guestSession.js';
import restaurantRoutes from './routes/restaurants.js';
import menuRoutes from './routes/menus.js';
import orderRoutes from './routes/orders.js';
import restaurantOrderRoutes from './routes/restaurantOrders.js';

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

// /v1 prefix: this is the first real route mounted, so it's the right
// moment to start versioning (SNAPORDER_GITHUB_SETUP.md already lists
// "API versioning from day 1" as non-negotiable, and SNAPORDER_API_
// CONTRACTS.md was designed around /v1/ throughout — it just hadn't
// been wired up in code yet). authLimiter applies in addition to (not
// instead of) the global generalLimiter, tightening the budget
// specifically for login/register.
app.use('/v1/auth', authLimiter, authRoutes);

// A small "who am I" route — not explicitly requested, but the natural
// way to prove the authenticate middleware works end-to-end, and
// genuinely useful (e.g. for a frontend to check "is my token still
// good" on load).
app.get('/v1/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// First real use of authorize() — see routes/staff.js.
app.use('/v1/restaurants/:restaurantId/staff', staffRoutes);

// Guest entry point: POST /v1/tables/:qrCodeId/scan (proximity-gated
// session issuance) and GET /v1/guest/session (authenticateGuest demo).
// Not behind authenticate/authorize — guests have no staff identity at
// all; see routes/guestSession.js and middleware/authGuest.js.
app.use('/v1', guestSessionRoutes);

// Public read endpoints — no auth. See routes/restaurants.js and
// routes/menus.js for why (view_menu has no ABAC condition in the
// permission matrix; a public directory/menu view is the natural
// reading of that, distinct from ordering itself, which does require
// a proximity-verified guest session below).
app.use('/v1/restaurants', restaurantRoutes);
app.use('/v1', menuRoutes); // /v1/restaurants/:id/menus, /v1/meals/:id, /v1/meals/:id/ingredients

// Guest ordering — behind authenticateGuest. See routes/orders.js for
// the full lifecycle and the allergen removal-policy enforcement.
app.use('/v1/orders', orderRoutes);

// Staff/kitchen side of order management — behind authenticate +
// authorize(). See routes/restaurantOrders.js.
app.use('/v1/restaurants/:restaurantId/orders', restaurantOrderRoutes);

async function start() {
  // Fail loudly before accepting any traffic if the schema can't be
  // brought up to date, rather than serving requests against a database
  // that's silently missing tables.
  await initDb();

  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});
