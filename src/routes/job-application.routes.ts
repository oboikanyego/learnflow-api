import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { addApplicationNote, createApplication, deleteApplication, getInterviewPrep, listApplications, updateApplication } from '../controllers/job-application.controller.js';

export const jobApplicationRouter = Router();
jobApplicationRouter.use(requireAuth);
jobApplicationRouter.get('/', listApplications);
jobApplicationRouter.post('/', createApplication);
jobApplicationRouter.patch('/:applicationId', updateApplication);
jobApplicationRouter.delete('/:applicationId', deleteApplication);
jobApplicationRouter.post('/:applicationId/notes', addApplicationNote);
jobApplicationRouter.get('/:applicationId/interview-prep', getInterviewPrep);
