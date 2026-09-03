import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

p.user.findMany({
  select: { id: true, email: true, name: true, role: true, status: true, googleId: true }
}).then(users => {
  console.log(JSON.stringify(users, null, 2));
}).catch(console.error).finally(() => p.$disconnect());
