import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { NotificationModel } from '../models/notification.model.js';
export async function listNotifications(req:AuthenticatedRequest,res:Response,next:NextFunction){try{res.json(await NotificationModel.find({ownerId:req.user!.id}).sort({createdAt:-1}).limit(100).lean());}catch(e){next(e);}}
export async function markNotificationRead(req:AuthenticatedRequest,res:Response,next:NextFunction){try{const item=await NotificationModel.findOneAndUpdate({_id:req.params.id,ownerId:req.user!.id},{readAt:new Date()},{new:true});if(!item)return res.status(404).json({message:'Notification not found'});res.json(item);}catch(e){next(e);}}
