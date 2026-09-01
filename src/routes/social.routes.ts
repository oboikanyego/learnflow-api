import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { commentPost, createChallenge, createGroup, createPost, getGroup, invitePartner, joinGroup, listGroups, reactPost, respondPartner, socialOverview } from '../controllers/social.controller.js';

export const socialRouter=Router();
socialRouter.use(requireAuth);
socialRouter.get('/overview',socialOverview);
socialRouter.post('/partners/invite',invitePartner);
socialRouter.patch('/partners/:id/respond',respondPartner);
socialRouter.get('/groups',listGroups);
socialRouter.post('/groups',createGroup);
socialRouter.post('/groups/join',joinGroup);
socialRouter.get('/groups/:groupId',getGroup);
socialRouter.post('/groups/:groupId/challenges',createChallenge);
socialRouter.post('/groups/:groupId/posts',createPost);
socialRouter.post('/posts/:postId/reactions',reactPost);
socialRouter.post('/posts/:postId/comments',commentPost);
