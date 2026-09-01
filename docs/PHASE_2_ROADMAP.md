# LearnFlow Phase 2 Roadmap

## Goal
Move LearnFlow from a working MVP into a reliable AI-assisted learning product while keeping billing out of the critical learning flow until usage patterns are proven.

## Implemented in Phase 2
- Richer, accessible global action/button hierarchy in the Angular UI.
- Provider-agnostic AI service supporting OpenAI, Groq and Gemini.
- Free-tier-friendly provider configuration through environment variables.
- AI Learning Coach for explanations, blockers, revision guidance and next-step suggestions.
- Provider status endpoint for diagnostics and future quota controls.

## Pending next
1. **AI usage tracking**
   - Record requests per user, provider, feature and day.
   - Protect free provider limits and prevent abuse.
   - Add configurable daily/monthly quotas.

2. **AI action approval workflow**
   - Coach may propose lessons, reschedules or plan changes.
   - User must review and explicitly approve before LearnFlow mutates data.
   - Keep a change/audit record for AI-assisted actions.

3. **Reminder production hardening**
   - Confirm scheduled reminder execution in production.
   - Add retry/error observability and delivery status.
   - Validate missed-lesson transitions across timezones.

4. **Notification preferences**
   - Allow users to choose reminder timing and channels.
   - Add email opt-in/opt-out controls.

5. **AI planner presentation**
   - Replace raw JSON preview with a readable phase/module/lesson preview.
   - Allow the learner to edit generated content before saving.

6. **Account/profile settings**
   - Timezone, name and notification preferences.
   - Future subscription/plan status will live here.

## Subscription phase — intentionally deferred
Subscriptions should be introduced after Phase 2 usage and reliability are validated.

Planned entitlement model:
- **Free**: core learning paths, board, import and limited AI usage.
- **Pro**: higher AI quotas, advanced planning/coaching, richer analytics and premium reminder features.
- **Future team tier**: shared learning paths, collaboration and administrative reporting.

Billing implementation should be isolated behind an entitlement service so learning, board and AI controllers ask for capabilities rather than checking a payment provider directly.

## Before billing
- Measure AI cost/request patterns.
- Define free monthly quotas.
- Add usage counters and enforcement.
- Decide payment gateway and recurring billing model.
- Add subscription lifecycle webhooks, retry handling and cancellation/grace-period rules.
