# LearnFlow — Business Requirements Document

## 1. Purpose
LearnFlow is a lightweight learning accountability platform inspired by Jira. It converts structured learning plans into trackable lessons, schedules study sessions, reminds users when it is time to learn, records completion/missed sessions, and visualizes progress.

## 2. Target users
- Developers following technical roadmaps
- Students and certification candidates
- Professionals following structured upskilling plans
- Mentors/coaches who want a simple progress view later

## 3. Core workflow
1. User creates an account.
2. User creates a learning path manually or imports an AI-generated XLSX/CSV plan.
3. System validates the import and shows a preview.
4. User confirms the import.
5. System creates phases, modules, lessons and scheduled study sessions.
6. Scheduled lessons appear on the board/calendar.
7. System sends reminders.
8. User marks lesson complete, in progress, skipped or rescheduled.
9. A lesson with an elapsed completion window is flagged missed.
10. Dashboard updates completion, missed lessons, study hours and streaks.

## 4. Functional requirements
### FR-01 Authentication
Users shall register, sign in, sign out and access only their own learning data.

### FR-02 Learning paths
Users shall create, edit, archive and view learning paths.

### FR-03 Learning hierarchy
A learning path shall support phases, modules and lessons in an ordered hierarchy.

### FR-04 Lesson lifecycle
Lessons shall support BACKLOG, SCHEDULED, IN_PROGRESS, MISSED, COMPLETED and SKIPPED states.

### FR-05 Study scheduling
A lesson may have a date, start time, duration and timezone-aware reminder preferences.

### FR-06 Excel/CSV import
The system shall accept `.xlsx` and `.csv` learning plans using the canonical columns:
Learning Path, Phase, Module, Lesson, Description, Date, Time, Duration, Priority, Resource.

### FR-07 Import validation
The system shall reject invalid rows, identify row-level errors, prevent accidental duplicate imports and allow preview before persistence.

### FR-08 Learning board
Users shall view lessons grouped by Backlog, Scheduled, In Progress, Missed and Completed.

### FR-09 Reminders
The system shall support configurable reminders before and at a lesson start time.

### FR-10 Missed lessons
When a scheduled lesson passes its configured completion window without completion, the system shall mark it MISSED and issue a missed-lesson notification.

### FR-11 Rescheduling
Users shall reschedule missed or upcoming lessons while preserving history.

### FR-12 Dashboard
Users shall see scheduled, completed, missed and remaining counts, completion percentage, study time and streak information.

### FR-13 Learning evidence
Users shall optionally attach notes, resource links, GitHub/PR links, certificate links and quiz/assessment evidence to a lesson.

### FR-14 Notifications
Notifications shall initially support email. Push/other channels may be added later without changing core lesson state logic.

### FR-15 Auditability
The system shall retain timestamps for creation, scheduling, status changes and completion.

### FR-16 AI integration (later phase)
The system shall support creating a learning plan from a natural-language learning goal and availability profile.

## 5. Non-functional requirements
- NFR-01: API endpoints shall be versioned.
- NFR-02: Secrets shall only be supplied through environment variables.
- NFR-03: Production frontend shall be deployable to Netlify.
- NFR-04: Production API shall be deployable to Render.
- NFR-05: MongoDB Atlas shall be used for deployed persistence.
- NFR-06: Strict TypeScript shall be used in UI and API code.
- NFR-07: Validation shall occur at trust boundaries.
- NFR-08: Controllers shall not contain direct database queries.
- NFR-09: Reminder processing shall become asynchronous via Redis/BullMQ when introduced.
- NFR-10: Health endpoints and structured logging shall support deployment monitoring.

## 6. Initial MongoDB collections
- users
- learningPaths
- phases
- modules
- lessons
- studySessions
- imports
- notifications
- learningEvidence
- auditEvents

## 7. Deployment
### Netlify
`learnflow-ui` is built with `npm run build`; SPA routing falls back to `/index.html`.

### Render
`learnflow-api` builds TypeScript and starts `dist/server.js`. `/health` is the health check.

### MongoDB Atlas
Render receives `MONGODB_URI` as an environment variable. Database credentials are never committed.

## 8. Definition of MVP done
The MVP is complete when a new user can import a ChatGPT-produced plan, see lessons on the board, receive an email reminder, mark a lesson complete, have an overdue lesson marked missed, reschedule it, and see updated dashboard progress.
