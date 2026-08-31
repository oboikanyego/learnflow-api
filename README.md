# LearnFlow API

Production-oriented Node.js/Express/TypeScript backend for LearnFlow, a learning accountability platform that turns manual, spreadsheet and AI-generated plans into scheduled lessons with reminders and progress tracking.

## Stack
- Node.js 20
- Express 5 + TypeScript (strict)
- MongoDB Atlas + Mongoose
- Zod validation
- JWT + bcrypt authentication
- SheetJS 0.20.3 for Excel/CSV imports
- OpenAI Responses API for AI learning-plan generation
- Resend REST API for optional email reminders
- Render deployment

## Core capabilities
- Register, login and authenticated profile lookup
- User-owned Learning Path CRUD
- Ordered Learning Path → Phase → Module → Lesson hierarchy
- Lesson states: BACKLOG, SCHEDULED, IN_PROGRESS, COMPLETED, MISSED, SKIPPED
- Excel/CSV import using the LearnFlow template contract
- Lesson scheduling, completion evidence and notes
- Persistent in-app reminder/missed notifications
- Optional email reminders
- Automatic missed-session detection
- Dashboard analytics and learning streaks
- AI plan preview and direct persistence into MongoDB

## Architecture
Core CRUD follows Route → Controller → Service → Repository → Mongoose Model → MongoDB. Cross-aggregate workflow controllers remain HTTP/orchestration focused and reuse validated domain models.

## Local development
```bash
cp .env.example .env
npm install
npm run dev
```

Required local values are `MONGODB_URI` and a `JWT_SECRET` of at least 32 characters. OpenAI and Resend are optional; the application still supports manual and spreadsheet learning plans without them.

## API overview
- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `/api/v1/learning-paths` — authenticated CRUD
- `GET /api/v1/learning-paths/:id/hierarchy`
- `POST /api/v1/learning-paths/:id/phases`
- `POST /api/v1/phases/:id/modules`
- `POST /api/v1/modules/:id/lessons`
- `PATCH /api/v1/lessons/:id`
- `POST /api/v1/imports/learning-plans`
- `GET /api/v1/notifications`
- `GET /api/v1/analytics`
- `POST /api/v1/ai/generate-plan`
- `POST /api/v1/system/run-reminders` — secured operational endpoint

## Spreadsheet contract
The first worksheet must contain these headers:

`Learning Path, Phase, Module, Lesson, Description, Date, Time, Duration, Priority, Resource`

One row represents one lesson. Scheduled rows become `SCHEDULED`; rows without a valid date remain in `BACKLOG`.

## Render deployment
Deploy `dev` while testing and switch the production service to `main` after release validation. `render.yaml` contains the web-service configuration.

Configure these Render environment variables:
- `MONGODB_URI`
- `CLIENT_ORIGIN` — deployed Netlify site URL
- `JWT_SECRET`
- `JWT_EXPIRES_IN=7d`
- `OPENAI_API_KEY` — optional
- `OPENAI_MODEL=gpt-5.6-luna`
- `RESEND_API_KEY` — optional
- `EMAIL_FROM` — use a verified sender for production email
- `REMINDER_CRON_SECRET`

## Reminder delivery on a hobby deployment
The API runs a minute-level reminder worker whenever the Render process is awake. Because hobby/free web services may sleep, `.github/workflows/reminder-scheduler.yml` can call the secured reminder endpoint every ten minutes.

Add these GitHub Actions repository secrets before enabling the production schedule:
- `LEARNFLOW_API_URL` — deployed Render base URL
- `REMINDER_CRON_SECRET` — must match the Render environment value

Scheduled GitHub workflows run from the repository default branch, so the schedule becomes active when the finished application is promoted to `main`.

## Quality gates
`.github/workflows/ci.yml` runs installation, strict TypeScript validation and a production build for pushes to `dev` and `main`.

## Branch strategy
- `dev` — all active application work until requirements are complete
- `main` — release-ready code only
