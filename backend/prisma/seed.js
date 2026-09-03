const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const president = await prisma.office.create({ data: { name: 'PRESIDENT' } });
  const vpaf = await prisma.office.create({
    data: {
      name: 'VICE PRESIDENT FOR ADMINISTRATION AND FINANCE',
      parentId: president.id,
    },
  });
  const ict = await prisma.office.create({
    data: {
      name: 'DIRECTOR INFORMATION TECHNOLOGY AND COMMUNICATION TECHNOLOGY',
      parentId: vpaf.id,
    },
  });
  await prisma.office.create({
    data: { name: 'MANAGEMENT INFORMATION SYSTEM (MIS)', parentId: ict.id },
  });
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
