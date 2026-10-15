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
      name: 'Office of the President',
      children: [
        { name: 'Gender and Development (GAD)' },
        { name: 'Planning, Monitoring and Evaluation Unit (PME)' },
        { name: 'Quality Management (QM)' },
        { name: 'Project Management Unit (PMU)/PPDM' },
        { name: 'Legal Unit' },
        { name: 'Information and Communication Technology Unit (ICT)' },
        { name: 'Internal Audit Unit (IAU)' },
        { name: 'General Services Unit (GSU)' },
      ],
    },
    {
      name: 'Office of the Vice President for Administration and Finance',
      children: [
        { name: 'Campus Director - Binalbagan Campus' },
        { name: 'Campus Director - Fortune Towne Campus' },
        { name: 'Campus Director - Alijis Campus' },
        { name: 'Business Affairs Office (BAO)' },
        { name: 'Disaster Risk Reduction Management (DRRM)' },
        { name: 'Financial Management Services Division (FMSD)' },
        { name: 'Administrative Services Division (ASD)' },
        { name: 'Cash Unit' },
        { name: 'Procurement Management Unit (PMU/BAC)' },
        {
          name: 'Human Resource Management Unit (HRMU) and Human Resource Development Office (HRDO)',
        },
        { name: 'Records Management Unit (RMU)' },
        { name: 'Supply and Property Management Unit (SPMU)' },
      ],
    },
    {
      name: 'Office of the Vice President for Academic Affairs',
      children: [
        { name: 'Advanced Education Program (AEP)' },
        { name: 'Curriculum and Instructional Materials Development (CIMD)' },
        { name: 'Center for Internationalization and External Relations (CIER)' },
        { name: 'National Service Training Program (NSTP)' },
        { name: 'Scholarships Office' },
        { name: 'College of Criminal Justice (CCJ) - Dean' },
        { name: 'College of Engineering (COE) - Dean' },
        { name: 'College of Computer Studies (CCS) - Dean' },
        { name: 'College of Arts and Sciences (CAS) - Dean' },
        {
          name: 'College of Business, Management, and Accountancy (CBMA) - Dean',
        },
        { name: 'College of Education (COED) - Dean' },
        { name: 'College of Industrial Technology (CIT) - Dean' },
        { name: 'College of Fisheries (COF) - Dean' },
        { name: 'Alumni Relations' },
        { name: 'Library and Information Services' },
        { name: 'Office for Student Affairs and Services (OSAS)' },
        { name: "Registrar's Office" },
        { name: 'Office of the Guidance Services (OGS)' },
      ],
    },
    {
      name: 'Office of the Vice President for Research, Extension and Intellectual Property',
      children: [
        { name: 'Research and Development Services (RDS)' },
        { name: 'Extension and Community Services (ECS)' },
        { name: 'Intellectual Property Management Office (IPMO)' },
      ],
    },
  ],
};

const QM_OFFICE_NAMES = ['Quality Management (QM)', 'Quality Management'];

// Dev users for the Quality Management office so the QM UI (QOAP/QOM) can be
// demoed. Password login: qm.director@chmsu.edu.ph or qm.staff@chmsu.edu.ph.
// Password for both: qm-dev-123
async function seedQmUsers() {
  const qmOffice = await prisma.office.findFirst({
    where: { name: { in: QM_OFFICE_NAMES } },
    select: { id: true },
  });

  if (!qmOffice) {
    console.warn('QM office not found; skipping QM user seed');
    return;
  }

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
  if (node.name === 'Office of the President') {
    const oldPresident = await prisma.office.findUnique({
      where: { name: 'Office of the University President' },
    });
    if (oldPresident) {
      await prisma.office.update({
        where: { id: oldPresident.id },
        data: { name: 'Office of the President' },
      });
    }
  }

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
