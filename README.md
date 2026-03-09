# DataDash — Excel to Dashboard SaaS

A production-ready SaaS platform that automatically converts Excel and CSV files into interactive, shareable dashboards.

## Architecture

```
data-dash/
├── frontend/          # React + TailwindCSS + Recharts
├── backend/           # Node.js + Express REST API
├── python-service/    # FastAPI data processing microservice
└── docker-compose.yml # Full stack orchestration
```

## Tech Stack

| Layer            | Technology                                   |
|------------------|----------------------------------------------|
| Frontend         | React 18, TailwindCSS, Recharts, Zustand     |
| Backend API      | Node.js, Express, JWT Auth                   |
| Data Processing  | Python, FastAPI, Pandas                      |
| Database         | PostgreSQL 15                                |
| Cache            | Redis 7                                      |
| File Storage     | Local / AWS S3 (configurable)                |
| Containerization | Docker + Docker Compose                      |

## Features

- **File Upload** — Excel (.xlsx, .xls) and CSV files up to 50MB
- **Auto Data Cleaning** — Trim whitespace, remove duplicates, normalize, type detection
- **Smart Suggestions** — Visualization recommendations based on data types
- **Dashboard Builder** — Drag-and-drop grid layout with 7 chart types
- **Interactive Filters** — Date range and multi-select filters
- **Export** — PDF export, PNG per chart
- **Sharing** — Public shareable dashboard links
- **Auth** — JWT + refresh token rotation
- **Workspaces** — Multi-user team workspaces
- **Dark Mode** — Full dark/light theme support

## Quick Start

### With Docker (recommended)

```bash
cp backend/.env.example backend/.env
docker-compose up --build
```

App will be available at:
- Frontend:  http://localhost:3000
- Backend:   http://localhost:3001
- Python:    http://localhost:8000

### Local Development

**Backend:**
```bash
cd backend && cp .env.example .env
npm install && npm run dev
```

**Python Service:**
```bash
cd python-service
pip install -r requirements.txt
cd src && uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install && npm run dev
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| POST | /api/auth/refresh | Refresh tokens |
| GET | /api/auth/me | Current user |

### Datasets
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/datasets/upload | Upload file |
| GET | /api/datasets/workspace/:id | List datasets |
| GET | /api/datasets/:id/suggestions | Viz suggestions |
| GET | /api/datasets/:id/chart-data | Chart data |

### Dashboards
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/dashboards | Create dashboard |
| GET | /api/dashboards/workspace/:id | List dashboards |
| PUT | /api/dashboards/:id | Update dashboard |
| PATCH | /api/dashboards/:id/share | Toggle sharing |
| POST | /api/dashboards/:id/widgets | Add widget |
| PATCH | /api/dashboards/:id/widgets/positions | Drag positions |

## Data Cleaning Pipeline

1. Column name normalization
2. Empty row/column removal
3. Whitespace trimming
4. Duplicate row removal
5. Sentence case conversion
6. Auto type detection (numeric, date, categorical, text)
7. Date format standardization

## Chart Types

| Type | Best For |
|------|----------|
| KPI | Single metric cards |
| Bar | Category comparisons |
| Line | Time series trends |
| Area | Cumulative trends |
| Pie | Part-to-whole (≤10 items) |
| Table | Raw data browsing |

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Change in production!
- `PYTHON_SERVICE_URL` — Python microservice URL
- `FRONTEND_URL` — CORS allowed origin
