import { LearningPathRepository, type CreateLearningPathInput, type UpdateLearningPathInput } from '../repositories/learning-path.repository.js';
import { sendPlanCreatedEmail } from './learning-email.service.js';

export class LearningPathService {
  constructor(private readonly repository = new LearningPathRepository()) {}
  list(ownerId: string) { return this.repository.findAll(ownerId); }
  async create(ownerId: string, input: CreateLearningPathInput) {
    const path = await this.repository.create(ownerId, input);
    void sendPlanCreatedEmail({ ownerId, learningPathId: path.id, title: path.title, source: 'created' });
    return path;
  }
  async get(ownerId: string, id: string) { const path = await this.repository.findById(ownerId, id); if (!path) throw Object.assign(new Error('Learning path not found'), { statusCode: 404 }); return path; }
  async update(ownerId: string, id: string, input: UpdateLearningPathInput) { const path = await this.repository.update(ownerId, id, input); if (!path) throw Object.assign(new Error('Learning path not found'), { statusCode: 404 }); return path; }
  async remove(ownerId: string, id: string) { const path = await this.repository.remove(ownerId, id); if (!path) throw Object.assign(new Error('Learning path not found'), { statusCode: 404 }); }
}
