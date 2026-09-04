export const runtimePolicyOpenApiPaths = {
  '/api/v1/auth/registration-policy': {
    get: { tags:['Authentication'],summary:'Get registration age policy',description:'Returns the minimum registration age currently configured in MongoDB. The server remains authoritative.',security:[],responses:{'200':{description:'Current registration policy'}} }
  },
  '/api/v1/auth/register': {
    post: { tags:['Authentication'],summary:'Register a user',description:'Date of birth is required and the database-managed minimum age is enforced.',security:[],responses:{'201':{description:'User registered'},'400':{description:'Invalid registration details'},'409':{description:'Email already registered'}} }
  },
  '/api/v1/admin/system-limits': {
    get: { tags:['Admin'],summary:'List runtime limits and policies',description:'Returns database-managed AI, YouTube, age-safety and inactive-account cleanup limits.',security:[{bearerAuth:[]}],responses:{'200':{description:'System limits'},'401':{description:'Authentication required'},'403':{description:'Administrator role required'}} }
  },
  '/api/v1/admin/system-limits/audit': {
    get: { tags:['Admin'],summary:'List immutable system-limit changes',security:[{bearerAuth:[]}],responses:{'200':{description:'System limit audit history'}} }
  },
  '/api/v1/admin/youtube-quota': {
    get: { tags:['Admin'],summary:'Read live YouTube search quota counters',security:[{bearerAuth:[]}],responses:{'200':{description:'Current YouTube quota usage and reset timestamps'}} }
  },
  '/api/v1/admin/system-limits/{key}': {
    patch: { tags:['Admin'],summary:'Update a runtime limit',description:'Updates one database-managed limit and appends an immutable audit record.',security:[{bearerAuth:[]}],parameters:[{name:'key',in:'path',required:true,schema:{type:'string'}}],responses:{'200':{description:'System limit updated'},'400':{description:'Invalid value'},'404':{description:'System limit not found'}} }
  },
  '/api/v1/admin/users': {
    get: { tags:['Admin'],summary:'List users with operational management data',description:'Returns presence, monthly AI usage, subscription progress, inactivity age, cleanup eligibility and entitlement data for up to 100 users.',security:[{bearerAuth:[]}],parameters:[{name:'q',in:'query',required:false,schema:{type:'string'}}],responses:{'200':{description:'Admin user-management rows'},'401':{description:'Authentication required'},'403':{description:'Administrator role required'}} }
  },
  '/api/v1/admin/users/{id}': {
    delete: { tags:['Admin'],summary:'Clear an eligible inactive learner account',description:'Permanently removes the learner account and owned application data only after the database-managed inactivity threshold is met. Admin accounts and the current admin cannot be removed.',security:[{bearerAuth:[]}],parameters:[{name:'id',in:'path',required:true,schema:{type:'string'}}],requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['reason','confirmation'],properties:{reason:{type:'string',minLength:5,maxLength:500},confirmation:{type:'string',enum:['DELETE']}}}}}},responses:{'200':{description:'Account and owned data cleared'},'400':{description:'Protected account or invalid request'},'404':{description:'User not found'},'409':{description:'Account has not reached the inactivity threshold'}} }
  }
} as const;
