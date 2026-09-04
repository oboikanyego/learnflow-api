import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';

async function main(): Promise<void> {
  const password = process.env.UAT_TEST_PASSWORD;
  const allowProduction = process.env.UAT_SEED_ALLOW_PRODUCTION === 'true';

  if (!password || password.length < 12) throw new Error('Set UAT_TEST_PASSWORD to at least 12 characters before running the UAT seed.');
  if (env.NODE_ENV === 'production' && !allowProduction) throw new Error('Refusing to seed UAT users in production. Set UAT_SEED_ALLOW_PRODUCTION=true explicitly if this is intentional.');

  await connectDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const adultDob = new Date(Date.UTC(now.getUTCFullYear() - 25, 0, 15));
  const minorDob = new Date(Date.UTC(now.getUTCFullYear() - 14, 5, 15));

  const users: Array<{name:string;email:string;role:'learner'|'admin';dateOfBirth?:Date}> = [
    { name: 'UAT Learner', email: 'learner.uat@example.com', role: 'learner', dateOfBirth: adultDob },
    { name: 'UAT Admin', email: 'admin.uat@example.com', role: 'admin', dateOfBirth: adultDob },
    { name: 'UAT Minor', email: 'minor.uat@example.com', role: 'learner', dateOfBirth: minorDob },
    { name: 'UAT Unknown Age', email: 'unknown-age.uat@example.com', role: 'learner' }
  ];

  for (const user of users) {
    await UserModel.updateOne(
      { email: user.email },
      {
        $set: {
          name: user.name,
          email: user.email,
          role: user.role,
          timezone: 'Africa/Johannesburg',
          passwordHash,
          entitlement: { plan: 'FREE', status: 'ACTIVE', source: 'SYSTEM' },
          ...(user.dateOfBirth ? { dateOfBirth: user.dateOfBirth } : {})
        },
        ...(user.dateOfBirth ? {} : { $unset: { dateOfBirth: 1 } })
      },
      { upsert: true }
    );
  }

  console.log('UAT users seeded:', users.map(user => user.email).join(', '));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
