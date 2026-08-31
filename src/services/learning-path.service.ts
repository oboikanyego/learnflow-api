import { LearningPathRepository, type CreateLearningPathInput } from '../repositories/learning-path.repository.js';

export class LearningPathService {
  constructor(private readonly repository = new LearningPathRepository()) {}
  list() { return this.repository.findAll(); }
  create(input: CreateLearningPathInput) { return this.repository.create(input); }
}
