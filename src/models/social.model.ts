import { Schema, model } from 'mongoose';

const accountabilityConnectionSchema = new Schema({
  requesterId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  recipientId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  status: { type: String, enum: ['PENDING','ACCEPTED','DECLINED'], default: 'PENDING', index: true }
}, { timestamps: true });
accountabilityConnectionSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });

const studyGroupSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  joinCode: { type: String, required: true, unique: true, index: true },
  memberIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }]
}, { timestamps: true });

const challengeSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  groupId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'StudyGroup' },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  targetMinutes: { type: Number, required: true, min: 30, max: 10080 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  status: { type: String, enum: ['ACTIVE','CLOSED'], default: 'ACTIVE', index: true }
}, { timestamps: true });

const progressPostSchema = new Schema({
  authorId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
  groupId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'StudyGroup' },
  body: { type: String, required: true, trim: true, maxlength: 1200 },
  milestoneType: { type: String, enum: ['UPDATE','LESSON','STREAK','MASTERY','FOCUS'], default: 'UPDATE' },
  reactions: [{ userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' }, kind: { type: String, enum: ['CLAP','FIRE','SUPPORT'], required: true } }],
  comments: [{ userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' }, body: { type: String, required: true, trim: true, maxlength: 500 }, createdAt: { type: Date, default: Date.now } }]
}, { timestamps: true });
progressPostSchema.index({ groupId: 1, createdAt: -1 });

export const AccountabilityConnectionModel = model('AccountabilityConnection', accountabilityConnectionSchema);
export const StudyGroupModel = model('StudyGroup', studyGroupSchema);
export const ChallengeModel = model('Challenge', challengeSchema);
export const ProgressPostModel = model('ProgressPost', progressPostSchema);
