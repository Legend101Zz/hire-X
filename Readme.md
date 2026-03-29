<div align="center">

# 🧠 Hire-X

### AI-Powered End-to-End Recruitment Automation Platform

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Claude AI](https://img.shields.io/badge/Claude-Anthropic-FF6B35?style=for-the-badge)](https://anthropic.com)

**From job description to hired candidate — fully automated.**

[Live Demo](https://dev.damnuiwdbbvte.amplifyapp.com) · [Architecture](#architecture) · [Setup Guide](#setup) · [How It Works](#how-it-works)

</div>

---

##  The Problem It Solves

Recruiters don't struggle to *find* candidates. They struggle to *connect* with them.

Traditional ATS tools dump a list of names and leave the rest to a recruiter's inbox. Hire-X automates the entire funnel — from intelligent candidate discovery across **56+ million LinkedIn profiles**, to AI-powered background analysis, personalized outreach, and fully autonomous AI-conducted telephonic interviews — delivering a ranked shortlist with rich insights directly to the HR team.

> Built for the Indian recruitment market. Designed to replace $500/month tools like LinkedIn Recruiter, Juicebox, and Weekday — at a fraction of the cost.

---

##  What Makes This Different

| Feature | Traditional ATS | Hire-X Hire |
|---|---|---|
| Candidate Search | Keyword filter | AI intent parsing + semantic ranking |
| Outreach | Manual, generic emails | Personalized, context-aware campaigns |
| Background Check | Manual Google search | Automated OSINT pipeline |
| Interview Scheduling | Calendar ping-pong | Auto-scheduled on candidate availability |
| First-Round Interview | Human phone screen | Vapi + Cartesia AI voice agent |
| Post-Interview Insight | "How'd the call go?" | Structured report with sentiment, confidence & fit score |

---

##  Architecture
```

┌─────────────────────────────────────────────────────────────────┐
│                         HR Dashboard                             │
│                 (Next.js 15 + shadcn/ui + Framer Motion)        │
└──────────────────────────────┬──────────────────────────────────┘
                               │  REST + WebSocket
┌──────────────────────────────▼──────────────────────────────────┐
│                      FastAPI Backend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Auth Layer   │  │  AI Engine   │  │  Workflow Orchestrator│  │
│  │ JWT + bcrypt │  │ Claude Sonnet│  │  (Campaign Pipeline)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└──────┬───────────────────┬──────────────────────┬───────────────┘
       │                   │                      │
┌──────▼──────┐  ┌─────────▼──────────┐  ┌───────▼──────────────┐
│   MongoDB   │  │   Redis (Cache +   │  │  External Services   │
│  56M+       │  │   Session + Queue) │  │  ┌────────────────┐  │
│  Profiles   │  └────────────────────┘  │  │ BrightData API │  │
│  Collection │                          │  │ (LinkedIn Data)│  │
└─────────────┘                          │  ├────────────────┤  │
                                         │  │  Vapi Voice AI │  │
                                         │  ├────────────────┤  │
                                         │  │Cartesia Sonic  │  │
                                         │  │  (TTS Voice)   │  │
                                         │  ├────────────────┤  │
                                         │  │ SendGrid/SMTP  │  │
                                         │  │  (Email Agent) │  │
                                         │  └────────────────┘  │
                                         └──────────────────────┘
```

---

## 🔄 How It Works — The Full Pipeline

### Phase 1 · Intelligent Candidate Discovery
```
HR types: "Find me a senior backend engineer with Go + Kubernetes, 
           fintech background, Bangalore, open to remote"
                              │
                              ▼
              ┌───────────────────────────┐
              │   Donna (AI Assistant)    │  ← Conversational query
              │   Claude Sonnet parses    │    builder — no forms
              │   intent, location, skills│
              └──────────────┬────────────┘
                             │
                             ▼
              ┌───────────────────────────┐
              │   Index-First Search      │  ← MongoDB compound
              │   56M+ LinkedIn profiles  │    indexes, not regex
              │   Sub-5 second results    │
              └──────────────┬────────────┘
                             │
                             ▼
              ┌───────────────────────────┐
              │   AI Ranking Engine       │  ← Skills validation,
              │   Scores + plain-English  │    experience weight,
              │   explanations per cand.  │    response likelihood
              └───────────────────────────┘
```

> **Dataset Note:** The LinkedIn profile dataset (56M+ records) is not included in this repo — it requires a paid BrightData subscription. See [Data Setup](#data-setup) below to plug in your own BrightData API key and seed the MongoDB `profiles` collection.

---

### Phase 2 · Hiring Campaign Pipeline

Once an HR selects candidates to pursue, the campaign pipeline fires automatically:
```
HR clicks "Start Campaign" on shortlisted candidates
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌──────────────────────┐             ┌────────────────────────┐
│  Background Analysis │             │   Contact Discovery    │
│                      │             │                        │
│ • GitHub activity    │             │ • Phone number lookup  │
│ • StackOverflow rep  │             │ • Work email inference │
│ • Patent/paper search│             │ • WhatsApp availability│
│ • Salary progression │             │ • Social presence      │
│ • Skill verification │             └───────────┬────────────┘
└──────────┬───────────┘                         │
           │                                     │
           └─────────────────┬───────────────────┘
                             │
                             ▼
              ┌───────────────────────────┐
              │  Candidate Report Card    │
              │  (Auto-generated PDF)     │
              │  • Role fit analysis      │
              │  • Engagement probability │
              │  • Red/green flags        │
              │  • Recommended opener     │
              └──────────────┬────────────┘
                             │
                             ▼
              ┌───────────────────────────┐
              │  Personalized Outreach    │
              │  AI drafts email/message  │
              │  referencing their work,  │
              │  recent activity, context │
              └──────────────┬────────────┘
                             │
                             ▼
              ┌───────────────────────────┐
              │  Interview Scheduler      │
              │  Sends calendar invite    │
              │  Confirms time slot       │
              └──────────────┬────────────┘
```

---

### Phase 3 · AI-Conducted Telephonic Interview
```
At scheduled time:
                              │
                              ▼
              ┌───────────────────────────┐
              │   Vapi Voice Agent        │
              │   + Cartesia Sonic TTS    │
              │                           │
              │  Conducts a structured    │
              │  phone interview:         │
              │  • Role-specific Qs       │
              │  • Follow-up probing      │
              │  • Culture fit assessment │
              │  • Compensation gauge     │
              └──────────────┬────────────┘
                             │
                             ▼
              ┌───────────────────────────┐
              │   Post-Interview Report   │
              │   (Delivered to HR)       │
              │                           │
              │  • Full transcript        │
              │  • Confidence score       │
              │  • Communication quality  │
              │  • Technical accuracy     │
              │  • Hire / Pass / Hold     │
              │    recommendation         │
              └───────────────────────────┘
```

---

## 🗂️ Project Structure
```
hire-X/
├── backend-mvp/               # FastAPI backend (production)
│   ├── main.py                # App entry point
│   ├── api.py                 # All route handlers
│   ├── auth.py                # JWT + bcrypt auth
│   ├── models.py              # Pydantic data models
│   ├── workflow.py            # Core business logic
│   ├── ai_model.py            # Claude AI integration
│   ├── redis_manager.py       # Cache + session layer
│   ├── websocket_manager.py   # Real-time pipeline updates
│   └── requirements.txt
│
├── backend-v2/                # v2 with enrichment + voice pipeline
│
├── frontend-mvp/              # Next.js 15 frontend
│   ├── app/
│   │   ├── dashboard/         # HR main workspace
│   │   ├── campaigns/         # Pipeline view
│   │   ├── candidates/        # Profile explorer
│   │   └── reports/           # Interview insights
│   └── package.json
│
├── .github/workflows/         # CI/CD (dev → main auto-PR)
├── ecosystem.config.js        # PM2 process config
└── backend.service            # systemd service file
```

---

## ⚙️ Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB 6.0+
- Redis 7.0+
- A [BrightData](https://brightdata.com) account (for LinkedIn data)
- Anthropic API key
- Vapi API key
- Cartesia API key

### 1. Clone & Install
```bash
git clone https://github.com/Legend101Zz/hire-X.git
cd hire-X

# Backend
cd backend-mvp
pip install -r requirements.txt

# Frontend
cd ../frontend-mvp
npm install
```

### 2. Environment Variables

Create `backend-mvp/.env`:
```env
# Auth
JWT_SECRET_KEY=your-very-secure-secret-key

# Database
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=Hire-X

# Redis
REDIS_URL=redis://localhost:6379

# AI
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=...

# Data (LinkedIn profiles)
BRIGHTDATA_API_KEY=...
BRIGHTDATA_DATASET_ID=...

# Voice Interview
VAPI_API_KEY=...
CARTESIA_API_KEY=...

# Outreach
SENDGRID_API_KEY=...
```

### 3. Data Setup

> The 56M+ LinkedIn profile dataset is **not included** in this repository. To populate your own:
```bash
# Option A: Use BrightData LinkedIn Dataset API
python backend-mvp/scripts/seed_from_brightdata.py \
  --api-key YOUR_BRIGHTDATA_KEY \
  --dataset-id YOUR_DATASET_ID \
  --limit 100000   # start with 100K for dev

# Option B: Import your own CSV/JSON dataset
python backend-mvp/scripts/import_profiles.py \
  --file /path/to/profiles.json
```

The script will create the `profiles` collection and build the required compound indexes automatically.

### 4. Start Services
```bash
# Terminal 1 — Redis
redis-server

# Terminal 2 — MongoDB
mongod --dbpath ./data/db

# Terminal 3 — Backend
cd backend-mvp && python main.py
# API: http://localhost:8000
# Docs: http://localhost:8000/docs

# Terminal 4 — Frontend
cd frontend-mvp && npm run dev
# App: http://localhost:3000
```

Or use PM2 for production:
```bash
pm2 start ecosystem.config.js
```

---

## 🔑 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/login` | Authenticate, receive JWT |
| `POST` | `/parse-prompt` | Convert natural language query to search params |
| `POST` | `/search` | Search + rank candidates from profile DB |
| `POST` | `/campaign/start` | Trigger full hiring pipeline for selected candidates |
| `GET` | `/campaign/{id}/status` | Real-time pipeline status |
| `GET` | `/candidate/{id}/report` | Full background analysis report |
| `GET` | `/interview/{id}/insights` | Post-interview AI summary |
| `WS` | `/session/{session_id}` | WebSocket for live updates |

---

##  Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com) — async Python API framework
- [MongoDB](https://mongodb.com) — profile storage (56M+ documents)
- [Redis](https://redis.io) — caching, session management, job queues
- [Claude Sonnet](https://anthropic.com) — query parsing, candidate analysis, report generation
- [Claude Haiku](https://anthropic.com) — high-volume, cost-efficient tasks

**Frontend**
- [Next.js 15](https://nextjs.org) + TypeScript
- [shadcn/ui](https://ui.shadcn.com) — component library
- [Framer Motion](https://framer.com/motion) — animations
- [TailwindCSS](https://tailwindcss.com)

**AI & Data**
- [Vapi](https://vapi.ai) — AI voice call orchestration
- [Cartesia Sonic](https://cartesia.ai) — ultra-low-latency TTS for interviews
- [BrightData](https://brightdata.com) — LinkedIn profile dataset
- [OpenRouter](https://openrouter.ai) — model routing fallback

**Infrastructure**
- Hostinger KVM VPS + Nginx reverse proxy
- PM2 process management
- GitHub Actions CI/CD (auto-PR from `dev` → `main` on `ready-for-prod` label)

---

##  Performance

| Metric | Value |
|--------|-------|
| Profile database size | 56M+ LinkedIn records |
| Search latency (p95) | < 5 seconds |
| Concurrent sessions | Redis-backed, horizontally scalable |
| AI model cold start | < 800ms (cached prompts) |
| Voice interview latency | < 400ms (Cartesia Sonic) |

---

## 🗺️Roadmap

- [x] Phase 1 — AI-powered candidate search & ranking
- [x] Phase 2 — Background analysis & personalized outreach
- [x] Phase 3 — Vapi + Cartesia AI telephonic interviews

---

## 🤝 Contributing

PRs are welcome. Please branch from `dev`, not `main`.
```bash
git checkout dev && git pull
git checkout -b feature/your-feature
# ... make changes ...
gh pr create --base dev
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ☕ and too many late nights by [Mrigesh Thakur](https://github.com/Legend101Zz)

*Turning "we're hiring" into "you're hired" — automatically.*

</div>
