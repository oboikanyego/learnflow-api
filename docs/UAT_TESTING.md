# LearnFlow UAT testing

## Seeded test personas

The complete repeatable persona and seeding guide is documented in [`docs/UAT_PERSONAS.md`](./UAT_PERSONAS.md).

Run only in an intended UAT environment:

```bash
UAT_TEST_PASSWORD='<strong test password>' npm run seed:uat
```

Production seeding is blocked unless `UAT_SEED_ALLOW_PRODUCTION=true` is explicitly supplied.

The seed is idempotent and creates/updates these accounts:

- `learner.uat@example.com` — normal adult learner
- `admin.uat@example.com` — administrator
- `minor.uat@example.com` — learner under the YouTube minor threshold
- `unknown-age.uat@example.com` — learner with no date of birth

Never commit the UAT password. Store it in the environment/secret manager used by the UAT deployment.

## Release-critical checks

1. Logged-out users cannot load protected routes.
2. Expired or server-rejected JWTs are cleared and redirect to Sign in.
3. Successful sign-in returns to the originally requested protected route.
4. Learners cannot render administrator routes; admins can.
5. Profile warns before discarding unsaved changes.
6. System-limit edits write immutable old/new audit entries.
7. Admin System Limits shows live YouTube Redis quota usage and reset windows.
8. Minor and unknown-age users use strict YouTube SafeSearch and cannot receive `ytAgeRestricted` results.
9. Made-for-Kids metadata is checked before embedding; privacy-enhanced YouTube embeds remain enabled.
10. Core authenticated pages render without horizontal overflow at 360px, 768px and desktop widths.
11. UAT personas can be restored repeatedly without creating duplicate accounts.
12. UAT seeding fails when `UAT_TEST_PASSWORD` is missing or invalid.
13. Production UAT seeding remains blocked unless `UAT_SEED_ALLOW_PRODUCTION=true` is deliberately supplied.

The UI Playwright suite automates the browser-level security and responsive checks with `npm run test:e2e`.
