export const runtimePolicyOpenApiPaths = {
  '/api/v1/auth/registration-policy': {
    get: {
      tags: ['Authentication'], summary: 'Get registration age policy',
      description: 'Returns the minimum registration age currently configured in MongoDB. The registration UI uses this policy, while the server remains authoritative.',
      security: [], responses: { '200': { description: 'Current registration policy', content: { 'application/json': { schema: { type: 'object', required: ['minimumAge'], properties: { minimumAge: { type: 'integer', example: 13 } } } } } } }
    }
  },
  '/api/v1/auth/register': {
    post: {
      tags: ['Authentication'], summary: 'Register a user',
      description: 'Date of birth is required. The server derives age at request time and enforces the database-managed minimum registration age.', security: [],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, required: ['name','email','password','dateOfBirth'], properties: { name:{type:'string',minLength:2,maxLength:80},email:{type:'string',format:'email'},password:{type:'string',format:'password',minLength:8,maxLength:128},dateOfBirth:{type:'string',format:'date',example:'1995-06-15'},timezone:{type:'string',example:'Africa/Johannesburg',default:'UTC'} } } } } },
      responses: { '201': { description: 'User registered; response includes JWT and user profile' }, '400': { description: 'Invalid registration details or minimum-age requirement not met' }, '409': { description: 'Email is already registered' } }
    }
  },
  '/api/v1/admin/system-limits': {
    get: { tags:['Admin'],summary:'List runtime limits and age-safety policies',description:'Returns seeded MongoDB configuration for AI quotas, YouTube search quotas and age-policy thresholds. Admin authentication is required.',security:[{bearerAuth:[]}],responses:{'200':{description:'System limits'},'401':{description:'Authentication required'},'403':{description:'Administrator role required'}} }
  },
  '/api/v1/admin/system-limits/audit': {
    get: { tags:['Admin'],summary:'List immutable system-limit changes',description:'Returns recent old-value to new-value changes with the administrator and timestamp.',security:[{bearerAuth:[]}],parameters:[{name:'limit',in:'query',required:false,schema:{type:'integer',minimum:1,maximum:250,default:100}}],responses:{'200':{description:'System limit audit history'},'401':{description:'Authentication required'},'403':{description:'Administrator role required'}} }
  },
  '/api/v1/admin/youtube-quota': {
    get: { tags:['Admin'],summary:'Read live YouTube search quota counters',description:'Reads current Redis counters and database-configured limits for global daily and current-admin hourly/daily YouTube search windows.',security:[{bearerAuth:[]}],responses:{'200':{description:'Current YouTube quota usage and reset timestamps'},'401':{description:'Authentication required'},'403':{description:'Administrator role required'}} }
  },
  '/api/v1/admin/system-limits/{key}': {
    patch: {
      tags:['Admin'],summary:'Update a runtime limit',description:'Updates one seeded system limit immediately and appends an immutable audit record. Changes do not require an application redeploy.',security:[{bearerAuth:[]}],
      parameters:[{name:'key',in:'path',required:true,schema:{type:'string'},example:'YOUTUBE_SEARCH_USER_DAILY'}],
      requestBody:{required:true,content:{'application/json':{schema:{type:'object',additionalProperties:false,required:['value'],properties:{value:{type:'integer',minimum:0,example:20}}}}}},
      responses:{'200':{description:'System limit updated and audited'},'400':{description:'Value is outside the configured safe range'},'401':{description:'Authentication required'},'403':{description:'Administrator role required'},'404':{description:'System limit not found'}}
    }
  }
} as const;
