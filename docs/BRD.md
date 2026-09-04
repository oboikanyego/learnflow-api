# LearnFlow — Business Requirements Document

## 1. Purpose
LearnFlow is a lightweight learning accountability platform inspired by Jira. It converts structured learning plans into trackable lessons, schedules study sessions, reminds users when it is time to learn, records completion/missed sessions, and visualizes progress.

## 2. Target users
- Developers following technical roadmaps
- Students and certification candidates
- Professionals following structured upskilling plans
- Mentors/coaches who want a simple progress view later
- Administrators responsible for user access, subscription controls, operational health and platform governance

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
11. Administrators monitor platform usage, entitlements, user activity and operational controls through protected administration screens.

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

### FR-16 AI integration
The system shall support creating a learning plan from a natural-language learning goal and availability profile, and shall provide AI-assisted coaching subject to configured plan limits and administrative usage controls.

### FR-17 Repeatable UAT personas
The system shall provide an explicit repeatable UAT seeding command so QA, developers and release testers can create or restore known test identities before a UAT cycle.

The command shall be exposed as:

```text
npm run seed:uat
```

The seed shall create or restore at least the following personas:

- Adult learner — standard learner behaviour.
- Administrator — administrator-only access and operational controls.
- Minor learner — age-sensitive and content-safety behaviour.
- Unknown-age learner — safe fallback behaviour when date of birth is unavailable.

The seed operation shall be idempotent and shall not create duplicate persona accounts when executed repeatedly.

### FR-18 UAT credential controls
The UAT seed shall require a runtime `UAT_TEST_PASSWORD` value that satisfies the application's password rules.

No usable UAT password shall be committed to source control, fixture data, repository documentation or example environment files.

The same runtime-supplied password may be applied to the known UAT personas for a controlled test cycle.

### FR-19 Production seed protection
The application shall block UAT persona seeding when executing in production mode unless an operator deliberately supplies:

```text
UAT_SEED_ALLOW_PRODUCTION=true
```

The production override shall not be required or recommended for normal UAT operation and shall not be configured as a permanent production setting.

### FR-20 UAT persona authorization coverage
The administrator UAT persona shall receive administrator authorization, while learner personas shall remain unable to access administrator-only routes and operations.

Minor and unknown-age personas shall exercise the strict age-sensitive safety path used by the application.

## 5. Non-functional requirements
- NFR-01: API endpoints shall be versioned.
- NFR-02: Secrets shall only be supplied through environment variables or approved secret-management mechanisms.
- NFR-03: Production frontend shall be deployable to Netlify.
- NFR-04: Production API shall be deployable to Render.
- NFR-05: MongoDB Atlas shall be used for deployed persistence.
- NFR-06: Strict TypeScript shall be used in UI and API code.
- NFR-07: Validation shall occur at trust boundaries.
- NFR-08: Controllers shall not contain direct database queries where service/repository abstractions are available.
- NFR-09: Reminder and long-running background processing shall use asynchronous queue processing when required.
- NFR-10: Health endpoints and structured logging shall support deployment monitoring.
- NFR-11: Repeatable test data must not weaken production authentication or expose reusable production credentials.
- NFR-12: UAT seed operations shall be deterministic, repeatable and safe to re-run.
- NFR-13: Production-only safeguards must fail closed unless an explicit operator override is supplied.
- NFR-14: UAT/test credentials shall never be stored in Git history.

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

Additional collections may support AI usage, billing, system limits, entitlements, retention, career outcomes and operational auditing as the product evolves.

## 7. Deployment
### Netlify
`learnflow-ui` is built with `npm run build`; SPA routing falls back to `/index.html`.

### Render
`learnflow-api` builds TypeScript and starts `dist/server.js`. `/health` is the primary application health check.

### MongoDB Atlas
Render receives `MONGODB_URI` as an environment variable. Database credentials are never committed.

### UAT environment
The UAT environment shall receive `UAT_TEST_PASSWORD` through its runtime environment or secret manager only when persona seeding is required.

Normal UAT seeding must not require `UAT_SEED_ALLOW_PRODUCTION`.

## 8. UAT and release testing
Repeatable UAT identities shall be documented in `docs/UAT_PERSONAS.md` and release-critical UAT scenarios shall be documented in `docs/UAT_TESTING.md`.

Before a UAT cycle, testers should be able to restore the known persona states by running `npm run seed:uat` with a valid runtime `UAT_TEST_PASSWORD`.

### UAT persona acceptance criteria
1. The seed command is explicitly available as `npm run seed:uat`.
2. The seed rejects execution when `UAT_TEST_PASSWORD` is missing or invalid.
3. Adult learner, administrator, minor learner and unknown-age learner personas are available after seeding.
4. Re-running the seed does not create duplicate persona accounts.
5. Administrator and learner authorization boundaries can be verified using the seeded identities.
6. Minor and unknown-age personas can be used to verify strict content-safety behaviour.
7. Production seeding is rejected unless the explicit production override is present.
8. No usable UAT credential is committed to the repository.

## 9. Definition of MVP done
The MVP is complete when a new user can import a ChatGPT-produced plan, see lessons on the board, receive an email reminder, mark a lesson complete, have an overdue lesson marked missed, reschedule it, and see updated dashboard progress.

The operationally testable product additionally requires repeatable UAT personas, protected administrator access and documented release-critical test flows so behaviour can be verified consistently between releases.
