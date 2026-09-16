# SnapOrder GitHub Setup & Development Environment

## Week 1: Foundation (THIS WEEK)

Goal: Set up development environment and create project foundation.

---

## Step 1: Install Git & Node.js (30 mins)

### Install Git (Windows)
1. Go to https://git-scm.com/download/win
2. Download the installer
3. Run installer, accept defaults
4. Open Command Prompt and verify:
   ```cmd
   git --version
   ```
   Should show: `git version 2.x.x`

### Install Node.js (Windows)
1. Go to https://nodejs.org/ (download LTS — v20.x or later)
2. Run installer, accept defaults
3. Restart Command Prompt
4. Verify:
   ```cmd
   node --version
   npm --version
   ```
   Should show: `v20.x.x` and `10.x.x`

**Total time: 15-20 mins**

---

## Step 2: Create GitHub Repository (10 mins)

### Create Repository on GitHub
1. Go to https://github.com/new
2. Fill in:
   - Repository name: `snaporder`
   - Description: `In-restaurant table-linked ordering system for health-conscious dining`
   - Visibility: Public (for portfolio)
   - Initialize with: README, .gitignore (Node.js)
3. Click "Create repository"

### Clone to Your Computer
1. On repository page, click "Code" button
2. Copy HTTPS URL (looks like `https://github.com/YOUR_USERNAME/snaporder.git`)
3. Open Command Prompt, navigate to where you want the project:
   ```cmd
   cd C:\Users\cherub\Projects
   git clone https://github.com/YOUR_USERNAME/snaporder.git
   cd snaporder
   ```

**Total time: 10 mins**

---

## Step 3: Project Structure (30 mins)

Create the following folder structure:

```
snaporder/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── services/          # Business logic (Order, Inventory, etc.)
│   │   ├── routes/            # API endpoints
│   │   ├── models/            # Database models
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── websocket/         # Kitchen Display System
│   │   ├── config/            # Environment, database
│   │   └── index.js           # Server entry point
│   ├── tests/
│   ├── .env.example
│   ├── .env.local             # Local secrets (not committed)
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── frontend/                   # React application
│   ├── public/
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── pages/             # Page routes
│   │   ├── services/          # API calls
│   │   ├── styles/            # CSS/Tailwind
│   │   ├── hooks/             # Custom React hooks
│   │   ├── App.jsx
│   │   └── index.jsx
│   ├── .env.example
│   ├── .env.local
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   └── README.md
│
├── docker-compose.yml         # Local dev environment (Postgres, Redis, RabbitMQ)
├── .gitignore
├── README.md                  # Main project overview
└── CONTRIBUTING.md            # Developer guidelines
```

### Create Folder Structure via Command Prompt:
```cmd
cd snaporder

# Backend
mkdir backend\src\{services,routes,models,middleware,websocket,config}
mkdir backend\tests

# Frontend
mkdir frontend\public
mkdir frontend\src\{components,pages,services,styles,hooks}

# Docker
# (already exists)
```

**Total time: 10-15 mins**

---

## Step 4: Initialize Backend (20 mins)

### Backend: package.json Setup

```cmd
cd backend
npm init -y
```

Edit `backend/package.json`:
```json
{
  "name": "snaporder-backend",
  "version": "1.0.0",
  "description": "SnapOrder in-restaurant ordering system API",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "test": "jest",
    "lint": "eslint src"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.10.0",
    "redis": "^4.6.7",
    "socket.io": "^4.6.1",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "paystack": "^2.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.7.0",
    "eslint": "^8.48.0"
  }
}
```

### Install Dependencies:
```cmd
npm install
```

This will take 2-3 mins and create `node_modules/` folder.

### Create .env.example (Backend):
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=snaporder
DB_USER=snaporder_user
DB_PASSWORD=changeme_in_local_env
DB_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# JWT
JWT_SECRET=your_jwt_secret_key_here_min_32_chars_long
JWT_EXPIRY=24h

# Paystack
PAYSTACK_API_KEY=sk_test_xxxxx
PAYSTACK_WEBHOOK_SECRET=xxxxx

# AWS S3 (for images)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=snaporder-images
AWS_REGION=eu-west-1
```

**Total time: 15 mins**

---

## Step 5: Initialize Frontend (20 mins)

### Frontend: Vite + React Setup

```cmd
cd ..\frontend
npm create vite@latest . -- --template react
npm install
```

### Add Tailwind CSS:
```cmd
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Update `frontend/tailwind.config.js`:
```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Install API Client:
```cmd
npm install axios
```

### Create .env.example (Frontend):
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_NAME=SnapOrder
```

### Update package.json scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src"
  }
}
```

**Total time: 15 mins**

---

## Step 6: Docker Compose Setup (15 mins)

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: snaporder_db
    environment:
      POSTGRES_USER: snaporder_user
      POSTGRES_PASSWORD: changeme_in_local_env
      POSTGRES_DB: snaporder
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U snaporder_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: snaporder_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # RabbitMQ Message Queue
  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    container_name: snaporder_rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"      # AMQP port
      - "15672:15672"    # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

### Start Services:
```cmd
docker-compose up -d
```

Verify:
```cmd
docker-compose ps
```

You should see 3 running containers.

### Stop Services (when done):
```cmd
docker-compose down
```

**Total time: 10 mins**

---

## Step 7: Initial Commit (10 mins)

```cmd
cd snaporder
git add .
git commit -m "Initial project structure: backend (Express), frontend (React+Vite), Docker services"
git push origin main
```

---

## Development Workflow

### Daily Development:

```cmd
# Start all services
docker-compose up -d

# Terminal 1: Backend server
cd backend
npm run dev

# Terminal 2: Frontend dev server
cd frontend
npm run dev

# Frontend: http://localhost:5173
# Backend: http://localhost:3000
# RabbitMQ Management: http://localhost:15672 (guest/guest)
```

### After Changes:

```cmd
# Commit changes
git add .
git commit -m "Feature: description"
git push origin main
```

---

## Next Steps (After Week 1)

1. **Database Schema** — Create tables using PostgreSQL
   - Run schema script in `backend/database/schema.sql`

2. **API Endpoints** — Build REST endpoints
   - Start with `/auth` (login/register)
   - Then `/menus` (menu listing)
   - Then `/orders` (order placement)

3. **Frontend Components** — Build React components
   - QR code scanner page
   - Menu browsing page
   - Order placement flow
   - Admin dashboard

4. **Real-Time Kitchen Display** — WebSocket connection
   - Backend: Socket.io server
   - Frontend: Kitchen display client

---

## Troubleshooting

### Git not found?
- Restart Command Prompt after installing Git
- Check `git --version` again

### Node/npm not found?
- Restart Command Prompt after installing Node
- Check `node --version` again

### Docker services won't start?
- Check Docker Desktop is running
- Run `docker-compose logs` to see error details

### Port already in use?
- Change ports in docker-compose.yml (e.g., 5433 instead of 5432)
- Update .env accordingly

### npm packages not installing?
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again

---

## Engineering Standards (Non-Negotiable)

Every line of code must follow:

### Code Quality
- ✅ DRY (Don't Repeat Yourself) — No duplicated logic
- ✅ KISS (Keep It Simple, Stupid) — Clear, readable code
- ✅ Single Responsibility — One function = one job
- ✅ Big O Awareness — No N+1 queries, O(1) lookups

### Reliability & Safety
- ✅ Async/await (never callback hell)
- ✅ Try/catch with proper error handling
- ✅ Input validation + sanitization
- ✅ Secure password hashing (bcryptjs)
- ✅ Secrets in .env (never hardcoded)
- ✅ Test pyramid: unit > integration > e2e

### Performance
- ✅ Redis caching for hot data (inventory, menus)
- ✅ Connection pooling (database)
- ✅ No N+1 queries
- ✅ Indexes on high-traffic columns

### Architecture
- ✅ Modular structure (services, routes, models)
- ✅ API versioning from day 1
- ✅ Docker containerization
- ✅ Environment-based config
- ✅ CI/CD pipeline (GitHub Actions)

### Team & Operations
- ✅ Meaningful commit messages
- ✅ PR reviews (even solo, write good descriptions)
- ✅ Documentation (README, code comments)
- ✅ Logging (not console.log)

---

## Resources

- **Git Guide:** https://git-scm.com/book/en/v2
- **Node.js Docs:** https://nodejs.org/docs/
- **Express.js Guide:** https://expressjs.com/
- **React Docs:** https://react.dev/
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Docker Compose:** https://docs.docker.com/compose/

---

**Setup Version:** 1.0  
**Last Updated:** Sept 16, 2025  
**Estimated Setup Time:** 2-3 hours total  
**Status:** Ready to code
