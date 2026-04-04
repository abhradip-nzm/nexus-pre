# 🚀 Nexus Pre — Enterprise Pre-Sales Workflow Platform

A modern, enterprise-grade pre-sales workflow management platform built with React (frontend) and Node.js (backend), backed by PostgreSQL.

---

## 🏗️ Architecture

```
nexus-pre/
├── frontend/          # React app (deploys to Netlify)
├── backend/           # Node.js Express API (deploys to Render/Railway)
├── netlify.toml       # Netlify deployment config
└── package.json       # Root scripts
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm 9+
- A free PostgreSQL database (see below)

---

### Step 1: Get a Free PostgreSQL Database

**Recommended: [Neon.tech](https://neon.tech)** (free tier, no credit card)

1. Sign up at https://neon.tech
2. Create a new project → choose a region
3. Copy the **Connection String** (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

Alternatives:
- [Supabase](https://supabase.com) — free tier available
- [ElephantSQL](https://www.elephantsql.com) — free 20MB tier
- Local PostgreSQL via Docker: `docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres`

---

### Step 2: Configure Backend

```bash
cd nexus-pre/backend
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development

# Paste your Neon/Supabase connection string here
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Generate a strong secret: openssl rand -base64 64
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars

# Optional integrations (can leave blank initially)
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_TENANT_ID=
MS_REDIRECT_URI=http://localhost:5000/api/auth/microsoft/callback

WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

FRONTEND_URL=http://localhost:3000
```

---

### Step 3: Configure Frontend

```bash
cd nexus-pre/frontend
cp .env.example .env
```

`.env` content:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

### Step 4: Install Dependencies

From the **root** of the project:

```bash
npm install           # Install root dev deps (concurrently)
npm run install:all   # Install backend + frontend deps
```

Or manually:
```bash
cd backend && npm install
cd ../frontend && npm install
```

---

### Step 5: Run Database Migrations

```bash
cd backend
npm run migrate
```

This will create all tables and seed default data (roles, kanban columns, sub-stages).

---

### Step 6: Create System Admin Account

After migrations, create your first admin via the setup endpoint:

```bash
curl -X POST http://localhost:5000/api/setup/init \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourcompany.com",
    "password": "SecurePass123!",
    "first_name": "System",
    "last_name": "Admin"
  }'
```

Or use Postman / any REST client.

> ⚠️ This endpoint only works **once** — after the first admin is created, it returns an error.

---

### Step 7: Start the Application

```bash
# From root (starts both backend + frontend simultaneously)
npm run dev

# Or start separately:
npm run dev:backend   # API on http://localhost:5000
npm run dev:frontend  # Frontend on http://localhost:3000
```

Open **http://localhost:3000** and log in with your admin credentials.

---

## 👥 User Roles

| Role | Description |
|------|-------------|
| **System Admin** | Full access, manages users, roles, permissions, settings |
| **Super Admin** | Same as manager, but system admin can restrict per-module |
| **Pre-Sales Manager** | Manages team, creates stories, views all KPIs |
| **Pre-Sales Executive** | Views stories, creates tasks, updates stories (with change log) |

### Creating Team Members

1. Login as System Admin
2. Go to **Team Management**
3. Click **Add User**
4. Set role and temporary password
5. Share credentials with team member

---

## 📋 Features

### Kanban Board
- Drag-and-drop user stories between stages
- 7 default columns: L1 Stage → L2 Stage → Commercial → Contract → Onboarded → Dark Leads → Closed Lost
- Configurable sub-stages per column (from Settings → Kanban Stages)
- Story cards show: priority, source, client company, assigned user, task progress, deal value

### Story Management
- Full CRUD with priority, tags, estimated deal value
- Sub-tasks with completion tracking
- Comments system
- Complete audit trail / change log (preserved for executive changes)
- Meeting links attached to stories

### Calendar
- Monthly calendar view with meeting overlay
- Click any day to see meetings
- Schedule meetings with MS Teams join links
- Link meetings to pipeline stories

### Dashboard KPIs
- Pipeline value, won revenue, win rate, today's meetings
- Pipeline by stage bar chart
- New leads 30-day trend chart
- Stage distribution pie chart
- Team performance leaderboard (managers only)
- Recent activity feed

### Team Management (System Admin)
- Create, edit, activate/deactivate users
- Reset passwords
- Assign roles
- Configure granular permissions for Super Admin users per module

---

## 🔗 Integrations

### Microsoft 365 (MS Teams + Outlook)

1. Create an app in [Azure Portal](https://portal.azure.com) → Azure Active Directory → App Registrations
2. Add API Permissions: `Calendars.Read`, `Mail.Read`, `User.Read`
3. Create a client secret
4. Set in backend `.env`:
   ```
   MS_CLIENT_ID=your-app-id
   MS_CLIENT_SECRET=your-secret
   MS_TENANT_ID=your-tenant-id
   ```
5. Enable in Settings → Integrations

### WhatsApp Business API

1. Set up [Meta for Developers](https://developers.facebook.com) account
2. Create WhatsApp Business app
3. Configure webhook URL: `https://your-backend.com/api/webhooks/whatsapp`
4. Set verify token and access token in `.env`
5. Enable in Settings → Integrations
6. Add monitored group IDs
7. Ensure each manager's WhatsApp number is saved in their profile

**How it works:** When a pre-sales manager is @tagged in a monitored group, Nexus Pre:
- Saves the message
- Creates a user story in L1 Stage
- Assigns it to the tagged manager
- Sends a notification in the app

---

## 🚀 Deployment

### Backend — Render.com (Free tier)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo, set **Root Directory** to `backend`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add all environment variables from `.env`
7. Set `NODE_ENV=production`

### Frontend — Netlify

1. Go to [netlify.com](https://netlify.com) → New Site
2. Connect your GitHub repo
3. Base directory: `frontend`
4. Build command: `npm run build`
5. Publish directory: `build`
6. Add environment variable: `REACT_APP_API_URL=https://your-render-backend.onrender.com/api`
7. Update `netlify.toml` redirect to point to your Render backend URL

---

## 🏃 Development Tips

### Resetting the Database
If you need to start fresh:
```bash
# Drop all tables and re-run migrations
cd backend
node -e "
const { pool } = require('./src/config/database');
require('dotenv').config();
pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  .then(() => { console.log('DB reset'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
"
npm run migrate
```

### Adding Test Data
After creating your admin, use the app to:
1. Create a few managers and executives
2. Create stories in different stages
3. Schedule some meetings

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, @dnd-kit, Recharts |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL (via `pg` driver) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Fonts | Inter + Noto Sans JP |
| Deploy | Netlify (frontend) + Render (backend) |

---

## 📁 Key Files

```
backend/src/
├── index.js              # Express server entry
├── config/database.js    # PG connection pool
├── migrations/schema.js  # All DB tables + seeds
├── middleware/auth.js    # JWT + role middleware
├── routes/index.js       # All API routes
└── controllers/
    ├── authController.js
    ├── userController.js
    ├── storyController.js
    ├── kanbanController.js
    ├── meetingController.js
    ├── dashboardController.js
    └── settingsController.js

frontend/src/
├── App.js                # Router + protected routes
├── contexts/AuthContext.js
├── utils/api.js          # Axios instance
├── utils/helpers.js      # Date/format utilities
├── styles/global.css     # Design system
└── pages/
    ├── Login.js
    ├── Dashboard.js
    ├── Kanban.js
    ├── Calendar.js
    ├── Team.js
    ├── Executives.js
    ├── Settings.js
    ├── ActivityLog.js
    └── Whatsapp.js
```

---

## 🔒 Security Notes

- All routes except `/login` and `/setup/init` require JWT authentication
- Role-based access control on every sensitive endpoint
- `/setup/init` only works once (fails after first admin is created)
- Passwords are hashed with bcrypt (12 salt rounds)
- Rate limiting: 500 requests per 15 minutes
- CORS restricted to frontend URL

---

## 📞 Support

This is a fully custom application. For issues:
1. Check the browser console for frontend errors
2. Check the backend terminal for API errors  
3. Verify all environment variables are set correctly
4. Ensure your PostgreSQL connection string is valid
