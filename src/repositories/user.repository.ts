import { UserModel } from '../models/user.model.js';

export class UserRepository {
  findByEmail(email: string, includePassword = false) {
    const query = UserModel.findOne({ email: email.toLowerCase() });
    return includePassword ? query.select('+passwordHash') : query;
  }

  findById(id: string) { return UserModel.findById(id); }

  create(input: { name: string; email: string; passwordHash: string; timezone: string }) {
    return UserModel.create({ ...input, email: input.email.toLowerCase() });
  }
}

export const userRepository = new UserRepository();
