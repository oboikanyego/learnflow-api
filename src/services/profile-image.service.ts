import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '../config/env.js';

let configured = false;

function configureCloudinary(): void {
  if (configured) return;
  if (!env.CLOUDINARY_URL) {
    throw Object.assign(new Error('Profile image uploads are not configured. Set CLOUDINARY_URL on the API service.'), { statusCode: 503 });
  }

  let parsed: URL;
  try {
    parsed = new URL(env.CLOUDINARY_URL);
  } catch {
    throw Object.assign(new Error('CLOUDINARY_URL is invalid.'), { statusCode: 503 });
  }

  if (parsed.protocol !== 'cloudinary:' || !parsed.hostname || !parsed.username || !parsed.password) {
    throw Object.assign(new Error('CLOUDINARY_URL must use cloudinary://<api_key>:<api_secret>@<cloud_name>.'), { statusCode: 503 });
  }

  cloudinary.config({
    cloud_name: parsed.hostname,
    api_key: decodeURIComponent(parsed.username),
    api_secret: decodeURIComponent(parsed.password),
    secure: true
  });
  configured = true;
}

export function cloudinaryConfigured(): boolean {
  return Boolean(env.CLOUDINARY_URL);
}

export async function uploadProfileImage(userId: string, buffer: Buffer): Promise<{ url: string; publicId: string }> {
  configureCloudinary();

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'learnflow/profile-images',
        public_id: userId,
        overwrite: true,
        invalidate: true,
        transformation: [
          {
            width: 512,
            height: 512,
            crop: 'fill',
            gravity: 'auto',
            quality: 85
          }
        ]
      },
      (error, response) => {
        if (error) return reject(error);
        if (!response) return reject(new Error('Cloudinary did not return an upload response.'));
        resolve(response);
      }
    );

    stream.end(buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteProfileImage(publicId: string): Promise<void> {
  configureCloudinary();
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw Object.assign(new Error('Cloudinary could not remove the profile image.'), { statusCode: 502 });
  }
}
