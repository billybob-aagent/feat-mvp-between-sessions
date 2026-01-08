import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

async function main() {
  const prisma = new PrismaClient();
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@betweensessions.local';
  const adminPass = process.env.ADMIN_PASSWORD || 'ChangeMeAdmin1!';
  const hash = await argon2.hash(adminPass);

  const existing = await prisma.users.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.users.create({
      data: {
        email: adminEmail,
        password_hash: hash,
        role: 'admin',
        email_verified_at: new Date(),
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Seeded admin: ${adminEmail} / ${adminPass}`);
  } else {
    console.log('Admin already exists');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});