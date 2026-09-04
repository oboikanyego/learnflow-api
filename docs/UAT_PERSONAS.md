# LearnFlow — Repeatable UAT Personas

## 1. Purpose

LearnFlow provides a repeatable set of User Acceptance Testing (UAT) personas so that authentication, role-based access, age-sensitive behaviour, administration and learner workflows can be tested against known user states.

The personas are created through an explicit seed command rather than by committing credentials or manually recreating test accounts.

## 2. Seed command

Run the UAT seed from the API repository:

```bash
UAT_TEST_PASSWORD='<strong test password>' npm run seed:uat
```

The seed command requires `UAT_TEST_PASSWORD` to be supplied at runtime.

No UAT password is stored in source control, documentation, fixture data or committed environment files.

## 3. UAT personas

The seed creates or updates the following repeatable personas.

| Persona | Account | Purpose |
| --- | --- | --- |
| Adult learner | `learner.uat@example.com` | Standard authenticated learner flows, learning paths, scheduling, AI, progress, billing/profile and learner permissions. |
| Administrator | `admin.uat@example.com` | Administrator-only navigation, system limits, user management, entitlement management, health and operational controls. |
| Minor learner | `minor.uat@example.com` | Age-sensitive behaviour, YouTube safety rules and other minor-specific controls. |
| Unknown-age learner | `unknown-age.uat@example.com` | Safe fallback behaviour when a user's date of birth is unavailable. |

All personas use the password supplied through `UAT_TEST_PASSWORD` when the seed is executed.

## 4. Repeatability and idempotency

The UAT seed is designed to be repeatable.

Running `npm run seed:uat` multiple times shall create missing personas or update existing seeded personas into their expected UAT state rather than creating duplicate accounts.

This allows QA, developers and release testers to reset known identities before executing a UAT cycle.

## 5. Password requirements

`UAT_TEST_PASSWORD` must be a strong password accepted by LearnFlow's password validation rules.

The password must:

- be provided through the runtime environment or approved secret manager;
- never be committed to Git;
- never be written into `.env.example` as a real credential;
- never be copied into screenshots, test evidence or shared documentation;
- be rotated when access to a shared UAT environment changes.

Example only:

```bash
export UAT_TEST_PASSWORD='<strong test password>'
npm run seed:uat
```

PowerShell example:

```powershell
$env:UAT_TEST_PASSWORD = '<strong test password>'
npm run seed:uat
```

## 6. Production safeguard

UAT seeding is blocked when the application is running in production mode.

The block may only be bypassed when an operator explicitly supplies:

```text
UAT_SEED_ALLOW_PRODUCTION=true
```

This override is intended only for exceptional, deliberate operational use. It must not be configured permanently in the production environment.

A production seed must therefore require two deliberate conditions:

1. a valid `UAT_TEST_PASSWORD`; and
2. the explicit `UAT_SEED_ALLOW_PRODUCTION=true` override.

## 7. Recommended UAT usage

Before a UAT cycle:

1. Confirm the target environment is the intended UAT/test environment.
2. Supply the approved `UAT_TEST_PASSWORD` through the environment or secret manager.
3. Run `npm run seed:uat`.
4. Confirm all four personas can authenticate as expected.
5. Execute the role/age-specific scenarios in `docs/UAT_TESTING.md`.
6. Remove temporary local environment values after testing where appropriate.

## 8. Persona coverage

### Adult learner

Use for:

- registration/authenticated learner behaviour;
- learning paths, phases, modules and lessons;
- board, backlog and scheduling;
- AI Planner and AI Coach;
- study history, mastery and retention;
- profile, plan and billing screens;
- learner-only authorization checks.

### Administrator

Use for:

- administrator route protection;
- user management;
- online/offline and inactivity views;
- AI usage monitoring;
- subscription/entitlement management;
- system limits;
- health/operations;
- administrative audit behaviour.

### Minor learner

Use for:

- age-aware application behaviour;
- strict YouTube safety filtering;
- age-restricted content exclusion;
- future minor-specific product safeguards.

### Unknown-age learner

Use for:

- safe defaults when date of birth is unavailable;
- strict age-sensitive content handling;
- backwards compatibility for accounts created before date-of-birth requirements.

## 9. Acceptance criteria

The repeatable UAT persona capability is accepted when:

1. `npm run seed:uat` is explicitly available in the API project.
2. The command fails when `UAT_TEST_PASSWORD` is missing or does not satisfy password requirements.
3. Adult learner, administrator, minor and unknown-age personas are created or restored to their expected state.
4. Re-running the command does not create duplicate persona accounts.
5. No UAT password or usable credential is committed to the repository.
6. Production execution is rejected unless `UAT_SEED_ALLOW_PRODUCTION=true` is explicitly supplied.
7. The administrator persona receives administrator authorization and learner personas do not.
8. Minor and unknown-age personas exercise the strict age-safety path.

## 10. Security notes

The UAT seed exists to make testing deterministic, not to create shared permanent credentials.

UAT accounts should be treated as test identities. Their passwords must be managed like other environment secrets, and production customer/user identities must never be modified by the UAT seed process.
