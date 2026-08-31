import type { Response,NextFunction } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { env } from '../config/env.js';

const schema=z.object({topic:z.string().min(2).max(120),weeks:z.number().int().min(1).max(52),days:z.array(z.string()).min(1).max(7),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),durationMinutes:z.number().int().min(15).max(240).default(60),startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
function extractText(data:any){if(typeof data.output_text==='string')return data.output_text;for(const item of data.output??[]){for(const c of item.content??[]){if(typeof c.text==='string')return c.text;}}return '';}
export async function generatePlan(req:AuthenticatedRequest,res:Response,next:NextFunction){
 try{const input=schema.parse(req.body);if(!env.OPENAI_API_KEY)return res.status(503).json({message:'AI plan generation is not configured. Set OPENAI_API_KEY on Render.'});
 const prompt=`Create a practical learning plan for ${input.topic}. Duration: ${input.weeks} weeks. Study days: ${input.days.join(', ')}. Start date: ${input.startDate}. Time: ${input.time}. Session duration: ${input.durationMinutes} minutes. Return ONLY valid JSON with shape {"learningPath":{"title":"...","description":"..."},"phases":[{"title":"...","modules":[{"title":"...","lessons":[{"title":"...","description":"...","date":"YYYY-MM-DD","time":"HH:mm","durationMinutes":60,"resourceUrl":""}]}]}]}. Keep lessons realistic and ordered. Do not include markdown fences.`;
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL,input:prompt})});
 if(!response.ok){const detail=await response.text();throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0,300)}`);}const data=await response.json();const text=extractText(data);let plan;try{plan=JSON.parse(text);}catch{throw new Error('AI returned an invalid plan format');}res.json(plan);
 }catch(e){next(e);}
}
