import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const officeListSelect = {
  id: true,
  name: true,
  parentId: true,
  headId: true,
  status: true,
  createdAt: true,
  head: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Record<string, unknown>;

const officeSelect = {
  id: true,
  name: true,
  status: true,
  headId: true,
  parentId: true,
  createdAt: true,
} satisfies Record<string, unknown>;

@Injectable()
export class OfficesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(take = 20, skip = 0) {
    return this.prisma.office.findMany({
      take,
      skip,
      orderBy: { name: 'asc' },
      select: officeListSelect,
    });
  }

  async findAllPaginated(take = 20, skip = 0) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.office.findMany({
        take,
        skip,
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          parentId: true,
          headId: true,
          members: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
            },
          },
          head: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          createdAt: true,
        },
      }),
      this.prisma.office.count({
        where: { status: 'ACTIVE' },
      }),
    ]);
    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async getAccessibleOfficeIds(user: AuthenticatedUser) {
    if (user.role === 'ADMIN' || user.role === 'PRESIDENTS') {
      const offices = await this.prisma.office.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      return offices.map((office) => office.id);
    }

    if (!user.office?.id) {
      return [];
    }

    if (user.role === 'OFFICE_HEAD') {
      return [user.office.id];
    }

    if (user.role === 'DIRECTORS') {
      const childOffices = await this.prisma.office.findMany({
        where: { parentId: user.office.id, status: 'ACTIVE' },
        select: { id: true },
      });

      return [user.office.id, ...childOffices.map((office) => office.id)];
    }

    if (user.role === 'VICE_PRESIDENTS') {
      return this.getOfficeSubtreeIds(user.office.id, true);
    }

    return [user.office.id];
  }

  async canAccessOffice(user: AuthenticatedUser, officeId: string) {
    const officeIds = await this.getAccessibleOfficeIds(user);
    return officeIds.includes(officeId);
  }

  async getSubordinateOfficeIds(user: AuthenticatedUser) {
    const officeIds = await this.getAccessibleOfficeIds(user);

    if (user.role === 'ADMIN') {
      return officeIds;
    }

    if (!user.office?.id) {
      return officeIds;
    }

    return officeIds.filter((officeId) => officeId !== user.office?.id);
  }

  async findAccessibleOffices(user: AuthenticatedUser) {
    const officeIds = await this.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      return [];
    }

    return this.prisma.office.findMany({
      where: {
        id: { in: officeIds },
        status: 'ACTIVE',
      },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        parentId: true,
        headId: true,
        status: true,
        head: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findByName(name: string) {
    return this.prisma.office.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, status: 'ACTIVE' },
      select: { id: true, name: true, parentId: true },
    });
  }

  private async getOfficeSubtreeIds(rootOfficeId: string, includeRoot = false) {
    const offices = await this.prisma.office.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, parentId: true },
    });

    const childMap = new Map<string, string[]>();

    for (const office of offices) {
      if (!office.parentId) {
        continue;
      }

      const siblings = childMap.get(office.parentId) ?? [];
      siblings.push(office.id);
      childMap.set(office.parentId, siblings);
    }

    const visited = new Set<string>();
    const queue = includeRoot
      ? [rootOfficeId]
      : [...(childMap.get(rootOfficeId) ?? [])];

    while (queue.length > 0) {
      const officeId = queue.shift();
      if (!officeId || visited.has(officeId)) {
        continue;
      }

      visited.add(officeId);

      for (const childId of childMap.get(officeId) ?? []) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }

    return [...visited];
  }

  private normalizeOfficeName(name: string): string {
    return name.trim();
  }

  private async ensureUniqueOfficeName(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const normalized = this.normalizeOfficeName(name);
    const existing = await this.prisma.office.findFirst({
      where: {
        name: { equals: normalized, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `An office with the name "${normalized}" already exists`,
      );
    }
  }

  async updateOffice(
    officeId: string,
    name?: string,
    userId?: string,
    parentId?: string,
    requestingUser?: AuthenticatedUser,
  ) {
    if (!officeId) {
      throw new BadRequestException('Missing required field: officeId');
    }

    const existingOffice = await this.prisma.office.findUnique({
      where: { id: officeId },
      select: { headId: true, name: true },
    });
    if (!existingOffice) {
      throw new NotFoundException('Office not found');
    }

    if (name) {
      await this.ensureUniqueOfficeName(name, officeId);
      name = this.normalizeOfficeName(name);
    }

    if (parentId) {
      if (parentId === officeId) {
        throw new BadRequestException('An office cannot be set as its own parent');
      }

      const descendants = await this.getOfficeSubtreeIds(officeId, true);
      if (descendants.includes(parentId)) {
        throw new BadRequestException(
          'Cannot set a descendant office as parent — would create a cycle',
        );
      }

      const parentOffice = await this.prisma.office.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parentOffice) {
        throw new NotFoundException('Parent office not found');
      }
      if (
        requestingUser &&
        !(await this.canAccessOffice(requestingUser, parentId))
      ) {
        throw new ForbiddenException(
          'You do not have permission to reassign an office under this parent',
        );
      }
    }

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          headOfOffice: { select: { id: true } },
        },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.headOfOffice && user.headOfOffice.id !== officeId) {
        throw new BadRequestException(
          'User is already heading another office.',
        );
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const office = await tx.office.update({
        where: { id: officeId },
        data: {
          ...(name && { name }),
          ...(userId && { headId: userId }),
          ...(parentId && { parentId }),
        },
        select: officeSelect,
      });

      if (userId && existingOffice.headId && existingOffice.headId !== userId) {
        //clear ol heads office id set to null
        await tx.user.update({
          where: { id: existingOffice.headId },
          data: { officeId: null },
        });
      }
      if (userId) {
        await tx.user.update({
          where: { id: userId },
          data: { officeId: officeId },
        });
      }
      return office;
    });
  }

  async addOffice(
    name: string,
    userId?: string,
    parentId?: string,
    requestingUser?: AuthenticatedUser,
  ) {
    if (!name) {
      throw new BadRequestException('Missing required field: name');
    }

    name = this.normalizeOfficeName(name);
    await this.ensureUniqueOfficeName(name);

    if (parentId) {
      const parentOffice = await this.prisma.office.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parentOffice) {
        throw new NotFoundException('Parent office not found');
      }
      if (
        requestingUser &&
        !(await this.canAccessOffice(requestingUser, parentId))
      ) {
        throw new ForbiddenException(
          'You do not have permission to create an office under this parent',
        );
      }
    }

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          headOfOffice: { select: { id: true } },
        },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.headOfOffice) {
        throw new BadRequestException(
          'User is already heading another office.',
        );
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const office = await tx.office.create({
        data: {
          name,
          ...(userId && { headId: userId }),
          ...(parentId && { parentId }),
        },
        select: officeSelect,
      });

      if (userId) {
        await tx.user.update({
          where: { id: userId },
          data: { officeId: office.id },
        });
      }

      return office;
    });
  }

  async getOfficeTree() {
    const offices = await this.prisma.office.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        parentId: true,
        headId: true,
        head: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const childMap = new Map<string, typeof offices>();

    for (const office of offices) {
      if (!office.parentId) continue;
      const siblings = childMap.get(office.parentId) ?? [];
      siblings.push(office);
      childMap.set(office.parentId, siblings);
    }

    const buildTree = (office: (typeof offices)[number]): unknown => ({
      id: office.id,
      name: office.name,
      parentId: office.parentId,
      headId: office.headId,
      head: office.head,
      memberCount: office._count.members,
      children: (childMap.get(office.id) ?? []).map(buildTree),
    });

    return offices.filter((office) => !office.parentId).map(buildTree);
  }

  async deleteAnOffice(officeId: string) {
    if (!officeId) {
      throw new BadRequestException('Missing required field: officeId');
    }

    return await this.prisma.$transaction(async (tx) => {
      const existingOffice = await tx.office.findUnique({
        where: { id: officeId },
        select: { headId: true },
      });
      if (!existingOffice) {
        throw new NotFoundException('Office not found');
      }

      const office = await tx.office.update({
        where: { id: officeId },
        data: { status: 'INACTIVE', headId: null },
        select: officeSelect,
      });

      if (existingOffice.headId) {
        await tx.user.update({
          where: { id: existingOffice.headId },
          data: { officeId: null },
        });
      }

      return office;
    });
  }
}
