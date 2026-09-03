import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { UserModel } from '../models/user.model.js';
import { deleteProfileImage, uploadProfileImage } from '../services/profile-image.service.js';

export async function uploadProfileImageController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a JPG, PNG or WebP profile image to upload.' });

    const user = await UserModel.findById(req.user!.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const uploaded = await uploadProfileImage(req.user!.id, req.file.buffer);
    user.profileImageUrl = uploaded.url;
    user.profileImagePublicId = uploaded.publicId;
    await user.save();

    res.status(201).json({
      profileImageUrl: user.profileImageUrl,
      message: 'Profile picture updated successfully.'
    });
  } catch (error) {
    next(error);
  }
}

export async function removeProfileImageController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await UserModel.findById(req.user!.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.profileImagePublicId) await deleteProfileImage(user.profileImagePublicId);
    user.profileImageUrl = undefined;
    user.profileImagePublicId = undefined;
    await user.save();

    res.json({ profileImageUrl: null, message: 'Profile picture removed.' });
  } catch (error) {
    next(error);
  }
}
