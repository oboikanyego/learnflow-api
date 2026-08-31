# LearnFlow API

Node.js/Express/TypeScript backend for LearnFlow, using MongoDB via Mongoose and designed for Render deployment.

## Stack
- Node.js
- Express
- TypeScript
- MongoDB Atlas + Mongoose
- Zod
- Render

## Architecture
Route → Controller → Service → Repository → Mongoose Model → MongoDB.

Controllers remain HTTP-focused, services own business rules, repositories isolate persistence, and schemas validate external input.

## Local development
```bash
cp .env.example .env
npm install
npm run dev
```

## Health check
`GET /health`

## API base
`/api/v1`

## Initial endpoints
- `GET /api/v1/learning-paths`
- `POST /api/v1/learning-paths`

## Future phases
Reminder workers will use Redis + BullMQ when asynchronous scheduling is introduced. They are intentionally not required for the initial CRUD runtime.
