export const lessonVideoOpenApiPaths = {
  '/api/v1/videos/lessons': {
    get: {
      tags: ['Lesson Videos'],
      summary: 'Search the current user’s lessons',
      description: 'Returns up to 20 matching lessons from the signed-in learner’s own curriculum. This does not call YouTube and is safe to use for lesson selection.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: false,
          schema: { type: 'string', maxLength: 120 },
          description: 'Optional lesson title/description search text.'
        }
      ],
      responses: {
        '200': { description: 'Matching lessons' },
        '401': { description: 'Authentication required' }
      }
    }
  },
  '/api/v1/videos/search': {
    post: {
      tags: ['Lesson Videos'],
      summary: 'Find embeddable YouTube videos for a lesson with AI assistance',
      description: 'AI turns the lesson title/description plus an optional refinement into a concise YouTube query. Results are limited to embeddable/syndicated videos and cached in Redis for six hours to protect YouTube search quota.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['lessonId'],
              properties: {
                lessonId: { type: 'string' },
                query: { type: 'string', maxLength: 120, example: 'beginner explanation with Angular examples' }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'AI-enhanced YouTube search results' },
        '401': { description: 'Authentication required' },
        '404': { description: 'Lesson not found' },
        '503': { description: 'YouTube API key is not configured' }
      }
    }
  }
} as const;
