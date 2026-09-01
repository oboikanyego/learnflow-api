import crypto from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { UserModel } from '../models/user.model.js';
import { StudySessionModel } from '../models/study-session.model.js';
import { AccountabilityConnectionModel, ChallengeModel, ProgressPostModel, StudyGroupModel } from '../models/social.model.js';

const objectId = z.string().refine(Types.ObjectId.isValid, 'Invalid id');
const emailSchema = z.object({ email: z.string().email() });
const groupSchema = z.object({ name: z.string().min(2).max(100), description: z.string().max(500).optional() });
const joinSchema = z.object({ joinCode: z.string().min(6).max(20) });
const challengeSchema = z.object({ title: z.string().min(2).max(140), targetMinutes: z.number().int().min(30).max(10080), startsAt: z.coerce.date(), endsAt: z.coerce.date() }).refine(v=>v.endsAt>v.startsAt,{message:'Challenge end must be after start'});
const postSchema = z.object({ body: z.string().min(1).max(1200), milestoneType: z.enum(['UPDATE','LESSON','STREAK','MASTERY','FOCUS']).optional() });
const reactionSchema = z.object({ kind: z.enum(['CLAP','FIRE','SUPPORT']) });
const commentSchema = z.object({ body: z.string().min(1).max(500) });

async function groupForMember(groupId:string,userId:string){return StudyGroupModel.findOne({_id:groupId,memberIds:userId});}

export async function socialOverview(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const userId=req.user!.id;
  const [incoming,outgoing,groups]=await Promise.all([
    AccountabilityConnectionModel.find({recipientId:userId,status:'PENDING'}).populate('requesterId','name email').lean(),
    AccountabilityConnectionModel.find({requesterId:userId,status:'PENDING'}).populate('recipientId','name email').lean(),
    StudyGroupModel.find({memberIds:userId}).sort({updatedAt:-1}).lean()
  ]);
  const accepted=await AccountabilityConnectionModel.find({status:'ACCEPTED',$or:[{requesterId:userId},{recipientId:userId}]}).populate('requesterId','name email').populate('recipientId','name email').lean();
  res.json({incoming,outgoing,partners:accepted,groups});
}catch(e){next(e);}}

export async function invitePartner(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const {email}=emailSchema.parse(req.body); const requesterId=req.user!.id;
  const recipient=await UserModel.findOne({email:email.toLowerCase()}).select('_id name email').lean();
  if(!recipient)return res.status(404).json({message:'No LearnFlow user exists with that email yet.'});
  if(String(recipient._id)===requesterId)return res.status(400).json({message:'You cannot invite yourself.'});
  const existing=await AccountabilityConnectionModel.findOne({$or:[{requesterId,recipientId:recipient._id},{requesterId:recipient._id,recipientId:requesterId}]});
  if(existing)return res.status(409).json({message:'An accountability connection already exists between these users.'});
  const connection=await AccountabilityConnectionModel.create({requesterId,recipientId:recipient._id});
  res.status(201).json(connection);
}catch(e){next(e);}}

export async function respondPartner(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const id=objectId.parse(req.params.id); const status=z.enum(['ACCEPTED','DECLINED']).parse(req.body?.status);
  const updated=await AccountabilityConnectionModel.findOneAndUpdate({_id:id,recipientId:req.user!.id,status:'PENDING'},{status},{new:true});
  if(!updated)return res.status(404).json({message:'Pending invitation not found.'}); res.json(updated);
}catch(e){next(e);}}

export async function createGroup(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const input=groupSchema.parse(req.body); const ownerId=req.user!.id; const joinCode=crypto.randomBytes(4).toString('hex').toUpperCase();
  res.status(201).json(await StudyGroupModel.create({...input,ownerId,joinCode,memberIds:[ownerId]}));
}catch(e){next(e);}}

export async function joinGroup(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const {joinCode}=joinSchema.parse(req.body); const group=await StudyGroupModel.findOneAndUpdate({joinCode:joinCode.toUpperCase()},{$addToSet:{memberIds:req.user!.id}},{new:true});
  if(!group)return res.status(404).json({message:'Study group not found.'}); res.json(group);
}catch(e){next(e);}}

export async function listGroups(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const groups=await StudyGroupModel.find({memberIds:req.user!.id}).sort({updatedAt:-1}).lean();
  res.json(groups);
}catch(e){next(e);}}

export async function getGroup(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const groupId=objectId.parse(req.params.groupId); const group=await StudyGroupModel.findOne({_id:groupId,memberIds:req.user!.id}).populate('memberIds','name email').lean();
  if(!group)return res.status(404).json({message:'Study group not found.'});
  const [challenges,posts]=await Promise.all([ChallengeModel.find({groupId}).sort({createdAt:-1}).lean(),ProgressPostModel.find({groupId}).sort({createdAt:-1}).limit(50).populate('authorId','name').populate('comments.userId','name').lean()]);
  const challengeRows=[];
  for(const challenge of challenges){
    const memberIds=(group.memberIds as any[]).map(m=>String(m._id));
    const sessions=await StudySessionModel.find({ownerId:{$in:memberIds},status:'COMPLETED',endedAt:{$gte:challenge.startsAt,$lte:challenge.endsAt}}).select('ownerId elapsedSeconds').lean();
    const progress=memberIds.map(memberId=>({memberId,minutes:Math.round(sessions.filter(s=>String(s.ownerId)===memberId).reduce((sum,s)=>sum+(s.elapsedSeconds||0),0)/60)}));
    challengeRows.push({...challenge,progress});
  }
  res.json({group,challenges:challengeRows,posts});
}catch(e){next(e);}}

export async function createChallenge(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const groupId=objectId.parse(req.params.groupId); const group=await groupForMember(groupId,req.user!.id); if(!group)return res.status(404).json({message:'Study group not found.'});
  const input=challengeSchema.parse(req.body); res.status(201).json(await ChallengeModel.create({...input,groupId,ownerId:req.user!.id}));
}catch(e){next(e);}}

export async function createPost(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const groupId=objectId.parse(req.params.groupId); if(!(await groupForMember(groupId,req.user!.id)))return res.status(404).json({message:'Study group not found.'});
  const input=postSchema.parse(req.body); res.status(201).json(await ProgressPostModel.create({...input,groupId,authorId:req.user!.id}));
}catch(e){next(e);}}

export async function reactPost(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const postId=objectId.parse(req.params.postId); const {kind}=reactionSchema.parse(req.body); const post=await ProgressPostModel.findById(postId); if(!post)return res.status(404).json({message:'Post not found.'});
  if(!(await groupForMember(String(post.groupId),req.user!.id)))return res.status(403).json({message:'Not a member of this study group.'});
  post.set('reactions',(post.get('reactions')??[]).filter((r:any)=>String(r.userId)!==req.user!.id)); (post.get('reactions') as any[]).push({userId:req.user!.id,kind}); await post.save(); res.json(post);
}catch(e){next(e);}}

export async function commentPost(req:AuthenticatedRequest,res:Response,next:NextFunction){try{
  const postId=objectId.parse(req.params.postId); const {body}=commentSchema.parse(req.body); const post=await ProgressPostModel.findById(postId); if(!post)return res.status(404).json({message:'Post not found.'});
  if(!(await groupForMember(String(post.groupId),req.user!.id)))return res.status(403).json({message:'Not a member of this study group.'});
  (post.get('comments') as any[]).push({userId:req.user!.id,body,createdAt:new Date()}); await post.save(); res.json(post);
}catch(e){next(e);}}
