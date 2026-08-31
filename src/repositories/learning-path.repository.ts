import { LearningPathModel, type LearningPathStatus } from '../models/learning-path.model.js';

export interface CreateLearningPathInput { title: string; description?: string; status?: LearningPathStatus }
export interface UpdateLearningPathInput { title?: string; description?: string; status?: LearningPathStatus }

export class LearningPathRepository {
  findAll(ownerId: string) { return LearningPathModel.find({ ownerId }).sort({ createdAt: -1 }).lean(); }
  findById(ownerId: string, id: string) { return LearningPathModel.findOne({ _id: id, ownerId }); }
  create(ownerId: string, input: CreateLearningPathInput) { return LearningPathModel.create({ ...input, ownerId }); }
  update(ownerId: string, id: string, input: UpdateLearningPathInput) { return LearningPathModel.findOneAndUpdate({ _id: id, ownerId }, input, { new: true, runValidators: true }); }
  remove(ownerId: string, id: string) { return LearningPathModel.findOneAndDelete({ _id: id, ownerId }); }
}
