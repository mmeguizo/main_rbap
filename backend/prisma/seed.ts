// prisma/seed.ts
import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaClient, Workspace } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type OfficeSeedNode = {
  name: string;
  children?: OfficeSeedNode[];
};

const officeTree: OfficeSeedNode = {
  name: 'CHMSU',
  children: [
    {
      name: 'Office of the University President',
      children: [
        { name: 'Gender and Development' },
        { name: 'Planning, Monitoring and Evaluation' },
        { name: 'Quality Management' },
        { name: 'Legal Counsel' },
        { name: 'University Secretary' },
        { name: 'Executive Assistant' },
        { name: 'Management Audit' },
      ],
    },
    {
      name: 'Office of the Vice President for Academic Affairs',
      children: [
        { name: 'College of Arts and Sciences' },
        { name: 'College of Business Management and Accountancy' },
        { name: 'College of Computer Studies' },
        { name: 'College of Criminal Justice' },
        { name: 'College of Education' },
        { name: 'College of Engineering' },
        { name: 'College of Fisheries' },
        { name: 'College of Industrial Technology' },
        { name: 'Advanced Education Program' },
        { name: 'Curriculum and Instructional Materials Development' },
        { name: 'Admission and Registrarship' },
        { name: 'Guidance Services' },
        { name: 'Library and Information Services' },
        { name: 'National Service Training Program' },
        { name: 'Student Affairs and Services' },
        { name: 'Scholarships' },
        { name: 'Internationalization and External Relations' },
        { name: 'Alumni Relations' },
      ],
    },
    {
      name: 'Office of the Vice President for Administration and Finance',
      children: [
        { name: 'Alijis Campus' },
        { name: 'Binalbagan Campus' },
        { name: 'Fortune Town Campus' },
        { name: 'Business Affairs' },
        { name: 'Human Resource Development' },
        { name: 'Information and Communication Technology' },
        { name: 'Physical Plant Development and Management' },
        { name: 'Disaster Risk Reduction Management' },
        {
          name: 'Administration Division',
          children: [
            { name: 'Human Resource Management' },
            { name: 'Procurement Management' },
            { name: 'Records Management' },
            { name: 'Property and Supply Management' },
            { name: 'Security' },
            { name: 'General Services' },
          ],
        },
        {
          name: 'Finance Division',
          children: [
            { name: 'Accounting' },
            { name: 'Budget' },
            { name: 'Cashier' },
          ],
        },
      ],
    },
    {
      name: 'Office of the Vice President for Research, Extension and Intellectual Property',
      children: [
        { name: 'Extension and Community Services' },
        { name: 'Intellectual Property Management' },
        {
          name: 'Research and Development Services',
          children: [
            { name: 'Research Ethics Review' },
            { name: 'Scientific Publication' },
          ],
        },
      ],
    },
  ],
};

const QM_OFFICE_NAME = 'Quality Management';

// Dev users for the Quality Management office so the QM UI (QOAP/QOM) can be
// demoed. Password login: qm.director@chmsu.edu.ph or qm.staff@chmsu.edu.ph.
// Password for both: qm-dev-123
async function seedQmUsers() {
  const qmOffice = await prisma.office.findUniqueOrThrow({
    where: { name: QM_OFFICE_NAME },
    select: { id: true },
  });

  const passwordHash = await hash('qm-dev-123', 10);

  const users = [
    {
      email: 'qm.director@chmsu.edu.ph',
      name: 'QM Admin',
      googleId: 'seed-qm-director',
      rbapRole: 'OFFICE_HEAD' as const,
      qmRole: 'ADMIN' as const,
    },
    {
      email: 'qm.staff@chmsu.edu.ph',
      name: 'QM Staff',
      googleId: 'seed-qm-staff',
      rbapRole: 'OFFICE_HEAD' as const,
      qmRole: 'OFFICE_HEAD' as const,
    },
  ];

  for (const user of users) {
    const savedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.rbapRole,
        status: 'ACTIVE',
        officeId: qmOffice.id,
      },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        googleId: user.googleId,
        role: user.rbapRole,
        status: 'ACTIVE',
        officeId: qmOffice.id,
      },
      select: { id: true },
    });
    await prisma.accountMembership.upsert({
      where: {
        userId_workspace: { userId: savedUser.id, workspace: Workspace.RBAP },
      },
      update: {
        role: user.rbapRole,
        officeId: qmOffice.id,
        status: 'ACTIVE',
      },
      create: {
        userId: savedUser.id,
        workspace: Workspace.RBAP,
        role: user.rbapRole,
        officeId: qmOffice.id,
      },
    });
    await prisma.accountMembership.upsert({
      where: {
        userId_workspace: { userId: savedUser.id, workspace: Workspace.QM },
      },
      update: { role: user.qmRole, officeId: qmOffice.id, status: 'ACTIVE' },
      create: {
        userId: savedUser.id,
        workspace: Workspace.QM,
        role: user.qmRole,
        officeId: qmOffice.id,
      },
    });
    console.log(`Seeded QM user: ${user.email}`);
  }
}

async function main() {
  await syncOfficeNode(officeTree, null);
  if (process.env.SEED_QM_USERS !== 'false') {
    await seedQmUsers();
  }
}

async function syncOfficeNode(node: OfficeSeedNode, parentId: string | null) {
  const office = await prisma.office.upsert({
    where: { name: node.name },
    update: {
      parentId,
      status: 'ACTIVE',
    },
    create: {
      name: node.name,
      parentId,
    },
    select: {
      id: true,
    },
  });

  for (const child of node.children ?? []) {
    await syncOfficeNode(child, office.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
