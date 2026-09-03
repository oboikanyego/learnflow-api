export const lessonVideoOpenApiPaths = {
  '/api/v1/videos/lessons': {
    get: {
      tags: ['Lesson Videos'],
      summary: 'Search the current user’s lessons',
      description: 'Returns up to 20 matching lessons from the signed-in learner’s own curriculum, including any saved lesson resource URL. This does not call YouTube.',
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
      summary: 'Find and verify YouTube videos for a lesson with AI assistance',
      description: 'AI creates a focused YouTube query, then LearnFlow verifies returned video IDs with videos.list before exposing them. Non-embeddable results are removed. Responses include duration, caption availability, Made for Kids state, publication metadata and privacy-enhanced youtube-nocookie.com embed URLs. Identical searches are cached in Redis for six hours and cache misses are protected by per-user and global search limits.',
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
        '200': {
          description: 'Verified AI-assisted YouTube results',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  lesson: { type: 'object', additionalProperties: true },
                  requestedQuery: { type: 'string' },
                  searchQuery: { type: 'string' },
                  aiEnhanced: { type: 'boolean' },
                  provider: { type: ['string', 'null'] },
                  videos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['videoId', 'title', 'watchUrl', 'embedUrl', 'durationSeconds', 'durationLabel', 'hasCaptions', 'madeForKids', 'trackingDisabled', 'embeddable'],
                      properties: {
                        videoId: { type: 'string', example: 'dQw4w9WgXcQ' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        channelTitle: { type: 'string' },
                        publishedAt: { type: 'string', format: 'date-time' },
                        thumbnailUrl: { type: 'string', format: 'uri' },
                        watchUrl: { type: 'string', format: 'uri' },
                        embedUrl: { type: 'string', format: 'uri', description: 'Privacy-enhanced youtube-nocookie.com embed URL.' },
                        durationIso: { type: 'string', example: 'PT18M42S' },
                        durationSeconds: { type: 'integer', minimum: 0 },
                        durationLabel: { type: 'string', example: '18:42' },
                        hasCaptions: { type: 'boolean' },
                        madeForKids: { type: 'boolean' },
                        trackingDisabled: { type: 'boolean', description: 'True for Made for Kids content. LearnFlow does not collect player analytics for these videos.' },
                        embeddable: { type: 'boolean', const: true },
                        privacyStatus: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '401': { description: 'Authentication required' },
        '404': { description: 'Lesson not found' },
        '429': { description: 'LearnFlow or YouTube search allowance reached. Response can include quota and resetsAt.' },
        '503': { description: 'YouTube API key is not configured' }
      }
    }
  },
  '/api/v1/videos/save-resource': {
    post: {
      tags: ['Lesson Videos'],
      summary: 'Save a YouTube video as the lesson resource',
      description: 'Stores the selected YouTube watch URL in the owned lesson resourceUrl and invalidates the relevant Redis learning caches.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['lessonId', 'videoId'],
              properties: {
                lessonId: { type: 'string' },
                videoId: { type: 'string', pattern: '^[A-Za-z0-9_-]{11}$' }
              }
            }
          }
        }
      },
      responses: {
        '200': { description: 'Video saved as the lesson resource' },
        '400': { description: 'Invalid YouTube video id' },
        '401': { description: 'Authentication required' },
        '404': { description: 'Lesson not found' }
      }
    }
  }
} as const;
