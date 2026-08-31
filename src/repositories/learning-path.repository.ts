import { LearningPathModel, type LearningPathDocument } from '../models/learning-path.model.js';

export interface CreateLearningPathInput { title: string; description?: string }

export class LearningPathRepository {
  async findAll(): Promise<LearningPathDocument[]> { return LearningPathModel.find().sort({ createdAt: -1 }).lean(); }
  async create(input: CreateLearningPathInput): Promise<LearningPathDocument> { return LearningPathModel.create(input); }
}
