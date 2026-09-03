type JsonSchema = Record<string, unknown>;
type Operation = Record<string, unknown>;

const genericObject: JsonSchema = { type: 'object', additionalProperties: true };
const errorSchema: JsonSchema = {
  type: 'object',
  properties: { message: { type: 'string', example: 'Validation failed' } },
  required: ['message']
};

const jsonBody = (schema: JsonSchema, required = true) => ({
  required,
  content: { 'application/json': { schema } }
});

const idParam = (name: string, description?: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string' }
});

const standardResponses = (successDescription = 'Request completed successfully') => ({
  '200': { description: successDescription },
  '400': { description: 'Invalid request', content: { 'application/json': { schema: errorSchema } } },
  '401': { description: 'Authentication required', content: { 'application/json': { schema: errorSchema } } },
  '404': { description: 'Resource not found', content: { 'application/json': { schema: errorSchema } } },
  '500': { description: 'Unexpected server error', content: { 'application/json': { schema: errorSchema } } }
});

const op = (
  tag: string,
  summary: string,
  options: {
    description?: string;
    security?: Array<Record<string, string[]>>;
    parameters?: Array<Record<string, unknown>>;
    requestBody?: Record<string, unknown>;
    responses?: Record<string, unknown>;
  } = {}
): Operation => ({
  tags: [tag],
  summary,
  ...(options.description ? { description: options.description } : {}),
  ...(options.security ? { security: options.security } : {}),
  ...(options.parameters ? { parameters: options.parameters } : {}),
  ...(options.requestBody ? { requestBody: options.requestBody } : {}),
  responses: options.responses ?? standardResponses()
});

const publicOperation = (tag: string, summary: string, options: Parameters<typeof op>[2] = {}) =>
  op(tag, summary, { ...options, security: [] });

const genericWrite = (tag: string, summary: string, parameters?: Array<Record<string, unknown>>) =>
  op(tag, summary, { parameters, requestBody: jsonBody(genericObject) });

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'LearnFlow API',
    version: '0.2.0',
    description:
      'REST API for LearnFlow learning plans, scheduling, study sessions, AI coaching and planning, retention, career tracking, social learning, billing and administration. Use the Authorize button with a JWT returned by /api/v1/auth/login or /api/v1/auth/register.'
  },
  servers: [
    { url: 'https://learnflow-api-njgz.onrender.com', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Local development' }
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Health', description: 'Public runtime health checks' },
    { name: 'Authentication', description: 'Registration, login and profile security' },
    { name: 'Onboarding', description: 'Initial user setup' },
    { name: 'Learning Paths', description: 'Top-level curricula' },
    { name: 'Curriculum', description: 'Phases, modules, lessons and comments' },
    { name: 'Goals', description: 'Learning goals' },
    { name: 'Study Sessions', description: 'Focus-session lifecycle and history' },
    { name: 'Analytics', description: 'Learning progress analytics' },
    { name: 'Intelligence', description: 'Calendar, adaptive coach and replanning' },
    { name: 'Retention', description: 'Spaced review queues and confidence' },
    { name: 'Assessments', description: 'AI mastery checkpoints' },
    { name: 'AI', description: 'AI provider, plan generation, jobs and coach' },
    { name: 'Imports', description: 'Spreadsheet learning-plan imports' },
    { name: 'Notifications', description: 'In-app notifications' },
    { name: 'Sharing', description: 'Private/public progress sharing' },
    { name: 'Career', description: 'Career targets and evidence' },
    { name: 'Job Intelligence', description: 'Job-description analysis' },
    { name: 'Applications', description: 'Job application pipeline' },
    { name: 'Career Outcomes', description: 'Offers and interview feedback' },
    { name: 'Social', description: 'Partners, groups, challenges and feed' },
    { name: 'Billing', description: 'Catalog, subscription and Paystack integration' },
    { name: 'Admin', description: 'Administrator-only operations' },
    { name: 'System', description: 'Internal operational actions' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the JWT returned by the LearnFlow login or registration endpoint.'
      }
    },
    schemas: {
      Error: errorSchema,
      GenericObject: genericObject,
      RegisterRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 80, example: 'BK Radipabe' },
          email: { type: 'string', format: 'email', example: 'bk@example.com' },
          password: { type: 'string', format: 'password', minLength: 8, maxLength: 128, example: 'ChangeMe123!' },
          timezone: { type: 'string', default: 'UTC', example: 'Africa/Johannesburg' }
        }
      },
      LoginRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'bk@example.com' },
          password: { type: 'string', format: 'password', minLength: 8, maxLength: 128 }
        }
      },
      LearningPathInput: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', minLength: 2, maxLength: 150, example: 'Learn React' },
          description: { type: 'string', maxLength: 1000 },
          status: { type: 'string', enum: ['BACKLOG', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] }
        }
      },
      PlanRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'weeks', 'days', 'time', 'startDate'],
        properties: {
          topic: { type: 'string', minLength: 2, maxLength: 120, example: 'React and Next.js' },
          weeks: { type: 'integer', minimum: 1, maximum: 52, example: 8 },
          days: { type: 'array', minItems: 1, maxItems: 7, items: { type: 'string' }, example: ['Monday', 'Wednesday', 'Saturday'] },
          time: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '19:00' },
          durationMinutes: { type: 'integer', minimum: 15, maximum: 240, default: 60 },
          startDate: { type: 'string', format: 'date', example: '2026-09-07' },
          save: { type: 'boolean', default: false }
        }
      },
      CoachRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 2, maxLength: 4000, example: 'What should I focus on this week?' },
          context: { type: 'string', maxLength: 4000 }
        }
      },
      ConfidenceReview: {
        type: 'object',
        additionalProperties: false,
        required: ['confidenceScore'],
        properties: { confidenceScore: { type: 'integer', minimum: 1, maximum: 5, example: 4 } }
      },
      AssessmentSubmission: {
        type: 'object',
        additionalProperties: false,
        required: ['answers'],
        properties: {
          answers: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'integer', minimum: 0, maximum: 3 }, example: [0, 2, 1, 3, 0] }
        }
      },
      NotificationPreferences: {
        type: 'object',
        additionalProperties: false,
        required: ['inAppReminders', 'emailReminders', 'reminderMinutes', 'missedSessionEmails', 'celebrationEmails', 'weeklyReviewEmails'],
        properties: {
          inAppReminders: { type: 'boolean' },
          emailReminders: { type: 'boolean' },
          reminderMinutes: { type: 'integer', minimum: 5, maximum: 1440 },
          missedSessionEmails: { type: 'boolean' },
          celebrationEmails: { type: 'boolean' },
          weeklyReviewEmails: { type: 'boolean' }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: publicOperation('Health', 'Check API liveness', {
        responses: { '200': { description: 'API is running' } }
      })
    },
    '/health/redis': {
      get: publicOperation('Health', 'Check deployed Redis connectivity', {
        description: 'Performs a Redis PING and returns configuration state plus connection latency without exposing credentials.',
        responses: {
          '200': { description: 'Redis is configured and reachable' },
          '503': { description: 'Redis is not configured or is unreachable' }
        }
      })
    },

    '/api/v1/auth/register': {
      post: publicOperation('Authentication', 'Register a user', {
        requestBody: jsonBody({ $ref: '#/components/schemas/RegisterRequest' }),
        responses: { '201': { description: 'User registered; response includes JWT' }, '400': { description: 'Invalid registration data' } }
      })
    },
    '/api/v1/auth/login': {
      post: publicOperation('Authentication', 'Log in', {
        requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' }),
        responses: { '200': { description: 'Authenticated; response includes JWT' }, '401': { description: 'Invalid credentials' } }
      })
    },
    '/api/v1/auth/forgot-password': {
      post: publicOperation('Authentication', 'Request password reset', {
        requestBody: jsonBody({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } })
      })
    },
    '/api/v1/auth/reset-password': {
      post: publicOperation('Authentication', 'Reset password', {
        requestBody: jsonBody({ type: 'object', required: ['token', 'password'], properties: { token: { type: 'string', minLength: 32 }, password: { type: 'string', minLength: 8, maxLength: 128 } } })
      })
    },
    '/api/v1/auth/me': { get: op('Authentication', 'Get current user') },
    '/api/v1/auth/profile': {
      patch: op('Authentication', 'Update profile', {
        requestBody: jsonBody({ type: 'object', required: ['name', 'timezone'], properties: { name: { type: 'string', minLength: 2, maxLength: 80 }, timezone: { type: 'string', example: 'Africa/Johannesburg' } } })
      })
    },
    '/api/v1/auth/change-password': {
      post: op('Authentication', 'Change password', {
        requestBody: jsonBody({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string', minLength: 8 }, newPassword: { type: 'string', minLength: 8, maxLength: 128 } } })
      })
    },
    '/api/v1/auth/notification-preferences': {
      patch: op('Authentication', 'Update notification preferences', { requestBody: jsonBody({ $ref: '#/components/schemas/NotificationPreferences' }) })
    },
    '/api/v1/auth/test-email': { post: op('Authentication', 'Send a communication self-test email') },

    '/api/v1/onboarding': {
      get: op('Onboarding', 'Get onboarding state'),
      put: genericWrite('Onboarding', 'Complete or update onboarding')
    },

    '/api/v1/learning-paths': {
      get: op('Learning Paths', 'List learning paths'),
      post: op('Learning Paths', 'Create a learning path', {
        requestBody: jsonBody({ allOf: [{ $ref: '#/components/schemas/LearningPathInput' }], required: ['title'] }),
        responses: { '201': { description: 'Learning path created' }, ...standardResponses() }
      })
    },
    '/api/v1/learning-paths/{id}': {
      get: op('Learning Paths', 'Get a learning path', { parameters: [idParam('id')] }),
      patch: op('Learning Paths', 'Update a learning path', { parameters: [idParam('id')], requestBody: jsonBody({ $ref: '#/components/schemas/LearningPathInput' }) }),
      delete: op('Learning Paths', 'Delete a learning path', { parameters: [idParam('id')], responses: { '204': { description: 'Deleted' }, '401': { description: 'Authentication required' }, '404': { description: 'Learning path not found' } } })
    },
    '/api/v1/learning-paths/{learningPathId}/hierarchy': {
      get: op('Curriculum', 'Get full Phase → Module → Lesson hierarchy', { parameters: [idParam('learningPathId')] })
    },
    '/api/v1/learning-paths/{learningPathId}/phases': {
      post: genericWrite('Curriculum', 'Create a phase', [idParam('learningPathId')])
    },
    '/api/v1/phases/{phaseId}/modules': {
      post: genericWrite('Curriculum', 'Create a module', [idParam('phaseId')])
    },
    '/api/v1/modules/{moduleId}/lessons': {
      post: genericWrite('Curriculum', 'Create a lesson', [idParam('moduleId')])
    },
    '/api/v1/lessons/{lessonId}': {
      get: op('Curriculum', 'Get a lesson', { parameters: [idParam('lessonId')] }),
      patch: genericWrite('Curriculum', 'Update lesson details, status or schedule', [idParam('lessonId')]),
      delete: op('Curriculum', 'Delete a lesson', { parameters: [idParam('lessonId')], responses: { '204': { description: 'Deleted' } } })
    },
    '/api/v1/lessons/{lessonId}/comments': {
      get: op('Curriculum', 'List lesson comments', { parameters: [idParam('lessonId')] }),
      post: genericWrite('Curriculum', 'Add a lesson comment', [idParam('lessonId')])
    },
    '/api/v1/phases/{phaseId}': {
      delete: op('Curriculum', 'Delete a phase', { parameters: [idParam('phaseId')], responses: { '204': { description: 'Deleted' } } })
    },
    '/api/v1/modules/{moduleId}': {
      delete: op('Curriculum', 'Delete a module', { parameters: [idParam('moduleId')], responses: { '204': { description: 'Deleted' } } })
    },

    '/api/v1/goals': {
      get: op('Goals', 'List learning goals'),
      post: genericWrite('Goals', 'Create a learning goal')
    },
    '/api/v1/goals/{id}': {
      patch: genericWrite('Goals', 'Update a learning goal', [idParam('id')]),
      delete: op('Goals', 'Delete a learning goal', { parameters: [idParam('id')], responses: { '204': { description: 'Deleted' } } })
    },

    '/api/v1/study-sessions': { get: op('Study Sessions', 'List study-session history') },
    '/api/v1/study-sessions/lesson/{lessonId}/active': { get: op('Study Sessions', 'Get active session for a lesson', { parameters: [idParam('lessonId')] }) },
    '/api/v1/study-sessions/lesson/{lessonId}/start': { post: genericWrite('Study Sessions', 'Start a focus session', [idParam('lessonId')]) },
    '/api/v1/study-sessions/{sessionId}/pause': { post: op('Study Sessions', 'Pause a focus session', { parameters: [idParam('sessionId')] }) },
    '/api/v1/study-sessions/{sessionId}/resume': { post: op('Study Sessions', 'Resume a focus session', { parameters: [idParam('sessionId')] }) },
    '/api/v1/study-sessions/{sessionId}/complete': { post: genericWrite('Study Sessions', 'Complete a focus session', [idParam('sessionId')]) },
    '/api/v1/study-sessions/{sessionId}/abandon': { post: op('Study Sessions', 'Abandon a focus session', { parameters: [idParam('sessionId')] }) },

    '/api/v1/analytics': { get: op('Analytics', 'Get progress analytics') },
    '/api/v1/intelligence/overview': { get: op('Intelligence', 'Get adaptive learning overview') },
    '/api/v1/intelligence/calendar': { get: op('Intelligence', 'Get upcoming learning calendar') },
    '/api/v1/intelligence/coach': { post: genericWrite('Intelligence', 'Generate progress review or coaching insight') },
    '/api/v1/intelligence/replan': { get: op('Intelligence', 'Propose a catch-up/replanning change') },
    '/api/v1/intelligence/replan/apply': { post: genericWrite('Intelligence', 'Apply proposed replanning') },

    '/api/v1/retention': { get: op('Retention', 'Get retention summary') },
    '/api/v1/retention/queue': { get: op('Retention', 'List due and upcoming reviews') },
    '/api/v1/retention/lessons/{lessonId}/review': {
      post: op('Retention', 'Complete a spaced review', { parameters: [idParam('lessonId')], requestBody: jsonBody({ $ref: '#/components/schemas/ConfidenceReview' }) })
    },

    '/api/v1/assessments/mastery': { get: op('Assessments', 'Get mastery summary') },
    '/api/v1/assessments/lessons/{lessonId}/latest': { get: op('Assessments', 'Get latest lesson assessment', { parameters: [idParam('lessonId')] }) },
    '/api/v1/assessments/lessons/{lessonId}/generate': { post: op('Assessments', 'Generate an AI mastery assessment', { parameters: [idParam('lessonId')] }) },
    '/api/v1/assessments/{assessmentId}/submit': {
      post: op('Assessments', 'Submit assessment answers', { parameters: [idParam('assessmentId')], requestBody: jsonBody({ $ref: '#/components/schemas/AssessmentSubmission' }) })
    },

    '/api/v1/ai/provider': { get: op('AI', 'Get configured AI provider status') },
    '/api/v1/ai/usage': { get: op('AI', 'Get current user AI usage and limits') },
    '/api/v1/ai/generate-plan': {
      post: op('AI', 'Generate a learning plan synchronously', { requestBody: jsonBody({ $ref: '#/components/schemas/PlanRequest' }) })
    },
    '/api/v1/ai/generate-plan/background': {
      post: op('AI', 'Queue a learning plan for background generation', {
        requestBody: jsonBody({ $ref: '#/components/schemas/PlanRequest' }),
        responses: { '202': { description: 'Generation queued in BullMQ/Redis' }, '503': { description: 'AI provider or background queue unavailable' } }
      })
    },
    '/api/v1/ai/plan-jobs': { get: op('AI', 'List recent background plan jobs') },
    '/api/v1/ai/plan-jobs/{id}': { get: op('AI', 'Get a background plan job', { parameters: [idParam('id')] }) },
    '/api/v1/ai/plan-jobs/{id}/retry': { post: op('AI', 'Retry a failed background plan job', { parameters: [idParam('id')], responses: { '202': { description: 'Retry queued' }, '409': { description: 'Only failed jobs can be retried' } } }) },
    '/api/v1/ai/coach': { post: op('AI', 'Ask the adaptive AI coach', { requestBody: jsonBody({ $ref: '#/components/schemas/CoachRequest' }) }) },

    '/api/v1/imports/learning-plans': {
      post: op('Imports', 'Import a learning plan spreadsheet', {
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary', description: 'XLSX/CSV learning-plan file. Server upload limit: 5 MB.' } } }
            }
          }
        },
        responses: { '200': { description: 'Plan imported' }, '400': { description: 'Invalid spreadsheet' }, '413': { description: 'File exceeds upload limit' } }
      })
    },

    '/api/v1/notifications': { get: op('Notifications', 'List notifications') },
    '/api/v1/notifications/{id}/read': { patch: op('Notifications', 'Mark notification as read', { parameters: [idParam('id')] }) },

    '/api/v1/share-progress/{learningPathId}': {
      post: op('Sharing', 'Enable public progress sharing', { parameters: [idParam('learningPathId')] }),
      delete: op('Sharing', 'Revoke public progress sharing', { parameters: [idParam('learningPathId')], responses: { '204': { description: 'Share revoked' } } })
    },
    '/api/v1/public/progress/{token}': { get: publicOperation('Sharing', 'View public shared progress', { parameters: [idParam('token', 'Public sharing token')] }) },

    '/api/v1/career/overview': { get: op('Career', 'Get career readiness overview') },
    '/api/v1/career/lessons': { get: op('Career', 'List career-relevant learning lessons') },
    '/api/v1/career/target': { put: genericWrite('Career', 'Create or update career target') },
    '/api/v1/career/evidence': { post: genericWrite('Career', 'Add skill evidence') },
    '/api/v1/career/evidence/{evidenceId}': { delete: op('Career', 'Delete skill evidence', { parameters: [idParam('evidenceId')], responses: { '204': { description: 'Deleted' } } }) },

    '/api/v1/career/jobs': { get: op('Job Intelligence', 'List saved job analyses') },
    '/api/v1/career/jobs/analyse': { post: genericWrite('Job Intelligence', 'Analyse a job description against learner evidence') },
    '/api/v1/career/jobs/{analysisId}': { get: op('Job Intelligence', 'Get a saved job analysis', { parameters: [idParam('analysisId')] }) },

    '/api/v1/career/applications': {
      get: op('Applications', 'List job applications'),
      post: genericWrite('Applications', 'Create a job application')
    },
    '/api/v1/career/applications/{applicationId}': {
      patch: genericWrite('Applications', 'Update a job application', [idParam('applicationId')]),
      delete: op('Applications', 'Delete a job application', { parameters: [idParam('applicationId')], responses: { '204': { description: 'Deleted' } } })
    },
    '/api/v1/career/applications/{applicationId}/notes': { post: genericWrite('Applications', 'Add an application note', [idParam('applicationId')]) },
    '/api/v1/career/applications/{applicationId}/interview-prep': { get: op('Applications', 'Generate or retrieve interview prep', { parameters: [idParam('applicationId')] }) },

    '/api/v1/career/outcomes': { get: op('Career Outcomes', 'Get offers and interview-outcome overview') },
    '/api/v1/career/outcomes/offers': { post: genericWrite('Career Outcomes', 'Create a job offer') },
    '/api/v1/career/outcomes/offers/{offerId}': {
      patch: genericWrite('Career Outcomes', 'Update a job offer', [idParam('offerId')]),
      delete: op('Career Outcomes', 'Delete a job offer', { parameters: [idParam('offerId')], responses: { '204': { description: 'Deleted' } } })
    },
    '/api/v1/career/outcomes/feedback': { post: genericWrite('Career Outcomes', 'Record interview/application outcome feedback') },

    '/api/v1/social/overview': { get: op('Social', 'Get social-learning overview') },
    '/api/v1/social/partners/invite': { post: genericWrite('Social', 'Invite a learning partner') },
    '/api/v1/social/partners/{id}/respond': { patch: genericWrite('Social', 'Accept or decline a partner invite', [idParam('id')]) },
    '/api/v1/social/groups': {
      get: op('Social', 'List study groups'),
      post: genericWrite('Social', 'Create a private study group')
    },
    '/api/v1/social/groups/join': { post: genericWrite('Social', 'Join a study group with a code') },
    '/api/v1/social/groups/{groupId}': { get: op('Social', 'Get study-group workspace', { parameters: [idParam('groupId')] }) },
    '/api/v1/social/groups/{groupId}/challenges': { post: genericWrite('Social', 'Create a group focus challenge', [idParam('groupId')]) },
    '/api/v1/social/groups/{groupId}/posts': { post: genericWrite('Social', 'Create a group progress post', [idParam('groupId')]) },
    '/api/v1/social/posts/{postId}/reactions': { post: genericWrite('Social', 'React to a group post', [idParam('postId')]) },
    '/api/v1/social/posts/{postId}/comments': { post: genericWrite('Social', 'Comment on a group post', [idParam('postId')]) },

    '/api/v1/billing/webhooks/paystack': {
      post: publicOperation('Billing', 'Receive Paystack webhook', {
        description: 'Provider webhook endpoint. Signature validation is performed server-side.',
        requestBody: jsonBody(genericObject)
      })
    },
    '/api/v1/billing/catalog': { get: op('Billing', 'Get billing catalog') },
    '/api/v1/billing/subscription': { get: op('Billing', 'Get current subscription') },
    '/api/v1/billing/checkout': { post: genericWrite('Billing', 'Create Paystack checkout') },
    '/api/v1/billing/cancel': { post: op('Billing', 'Cancel current subscription') },

    '/api/v1/admin/overview': { get: op('Admin', 'Get administrator overview') },
    '/api/v1/admin/system-health': { get: op('Admin', 'Get dependency and queue system health') },
    '/api/v1/admin/users': { get: op('Admin', 'List users and entitlement status') },
    '/api/v1/admin/users/{id}/entitlement': { patch: genericWrite('Admin', 'Update user entitlement', [idParam('id')]) },
    '/api/v1/admin/users/{id}/entitlement-history': { get: op('Admin', 'Get user entitlement audit history', { parameters: [idParam('id')] }) },
    '/api/v1/admin/billing-settings': {
      get: op('Admin', 'Get billing settings'),
      patch: genericWrite('Admin', 'Update billing settings')
    },
    '/api/v1/admin/billing-settings/audit': { get: op('Admin', 'Get billing-settings audit trail') },
    '/api/v1/admin/subscription-operations': { get: op('Admin', 'Get subscription operations') },
    '/api/v1/admin/billing-events': { get: op('Admin', 'List billing webhook events') },

    '/api/v1/system/run-reminders': { post: op('System', 'Run one reminder-worker cycle', { description: 'Operational endpoint used by the reminder scheduler.' }) }
  }
} as const;
