import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Prisma, Role, UserStatus, Workspace } from '@prisma/client';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

const managedUserSelect = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  status: true,
  role: true,
  supervisor: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  office: {
    select: {
      id: true,
      name: true,
    },
  },
  memberships: {
    orderBy: { workspace: 'asc' as const },
    select: {
      id: true,
      workspace: true,
      role: true,
      status: true,
      office: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

const googleAuthUserSelect = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  status: true,
  role: true,
  memberships: {
    where: { workspace: 'RBAP' as const },
    take: 1,
    select: { id: true, workspace: true },
  },
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  hasPassword: boolean;
  office: {
    id: string;
    name: string;
  } | null;
};

type AuthUserRecord = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  passwordHash: string | null;
  office: {
    id: string;
    name: string;
  } | null;
};

type PasswordLoginUser = AuthUser & {
  passwordHash: string | null;
};

export type MembershipAuthUser = PasswordLoginUser & {
  accountId: string;
  workspace: Workspace;
  membershipStatus: string;
};

type GoogleAuthUser = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  status: string;
  role: string;
  accountId?: string;
  workspace?: 'RBAP' | 'QM';
};

type GoogleRegistrationCandidate = {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
};

export type GoogleAuthLookupResult =
  | {
      kind: 'existing_user';
      user: GoogleAuthUser;
    }
  | {
      kind: 'registration_required';
      registration: GoogleRegistrationCandidate;
    };

function isValidRole(value: string): value is Role {
  return Object.values(Role).includes(value as Role);
}

const supervisorRolesByRole: Record<Role, readonly Role[]> = {
  [Role.ADMIN]: [],
  [Role.PRESIDENTS]: [Role.ADMIN],
  [Role.VICE_PRESIDENTS]: [Role.ADMIN, Role.PRESIDENTS],
  [Role.DIRECTORS]: [Role.VICE_PRESIDENTS],
  [Role.OFFICE_HEAD]: [Role.DIRECTORS],
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private mapAuthUser(user: AuthUserRecord): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      hasPassword: !!user.passwordHash,
      office: user.office,
    };
  }

  async findAll(take = 20, skip = 0, search?: string) {
    const where: Record<string, unknown> | undefined = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { role: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take,
        skip,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        select: managedUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, take, skip };
  }

  async findForGoogleAuth(data: {
    googleId: string;
    email: string;
    name: string;
    avatar?: string;
  }): Promise<GoogleAuthLookupResult> {
    const existingUser = await this.prisma.user.findUnique({
      where: { googleId: data.googleId },
      select: googleAuthUserSelect,
    });

    if (existingUser) {
      return {
        kind: 'existing_user',
        user: {
          ...existingUser,
          accountId: existingUser.memberships[0]?.id,
          workspace: 'RBAP',
        },
      };
    }

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: data.email },
      select: googleAuthUserSelect,
    });

    if (existingByEmail) {
      const linkedUser = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: data.googleId,
          avatar: data.avatar || existingByEmail.avatar,
        },
        select: googleAuthUserSelect,
      });

      return {
        kind: 'existing_user',
        user: {
          ...linkedUser,
          accountId: linkedUser.memberships[0]?.id,
          workspace: 'RBAP',
        },
      };
    }

    return {
      kind: 'registration_required',
      registration: {
        googleId: data.googleId,
        email: data.email,
        name: data.name,
        avatar: data.avatar ?? null,
      },
    };
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const role = dto.role ?? Role.OFFICE_HEAD;
    const supervisorId = dto.supervisorId?.trim() || null;

    if (!email.endsWith('@chmsu.edu.ph')) {
      throw new BadRequestException('Only @chmsu.edu.ph accounts are allowed.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists.');
    }

    await this.ensureValidSupervisor(role, supervisorId);

    const googleId = `manual-${email}`;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: dto.name,
          role,
          officeId: dto.officeId || null,
          supervisorId,
          googleId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          status: true,
          role: true,
          supervisor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          office: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      await this.syncWorkspaceMemberships(tx, {
        userId: created.id,
        role: created.role,
        officeId: created.office?.id ?? null,
        status: created.status,
        syncRole: true,
      });
      return created;
    });
  }

  async createWithPassword(data: {
    email: string;
    name: string;
    passwordHash: string;
    googleId: string;
    avatar?: string | null;
  }) {
    const email = data.email.trim().toLowerCase();

    return this.prisma.user.create({
      data: {
        email,
        name: data.name,
        passwordHash: data.passwordHash,
        googleId: data.googleId,
        avatar: data.avatar ?? null,
        role: Role.OFFICE_HEAD,
        officeId: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });
  }

  async findById(id: string) {
    const results = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        role: true,
        passwordHash: true,
        office: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!results) throw new UnauthorizedException('User not found');
    if (results.status === 'INACTIVE') {
      throw new ForbiddenException(
        'Account is inactive. Please contact admin.',
      );
    }
    const hasPassword = !!results.passwordHash;
    delete (results as { passwordHash?: string }).passwordHash;
    return {
      ...results,
      hasPassword,
      office: results.office
        ? {
            id: results.office.id,
            name: results.office.name,
          }
        : null,
    };
  }

  async findAdminUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: managedUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async checkUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!user;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        passwordHash: true,
        office: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return user ? this.mapAuthUser(user) : null;
  }

  async findAdminUserByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: managedUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findPasswordLoginUserByEmail(
    email: string,
  ): Promise<PasswordLoginUser | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        passwordHash: true,
        office: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      ...this.mapAuthUser(user),
      passwordHash: user.passwordHash,
    };
  }

    async findMembershipLoginUserByEmail(
      email: string,
      workspace: Workspace,
    ): Promise<MembershipAuthUser | null> {
      const user = await this.prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          passwordHash: true,
          memberships: {
            where: { workspace },
            take: 1,
            select: {
              id: true,
              workspace: true,
              role: true,
              status: true,
              office: { select: { id: true, name: true } },
            },
          },
        },
      });
      const membership = user?.memberships[0];
      if (!user || !membership) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: membership.role,
        status: user.status,
        hasPassword: !!user.passwordHash,
        passwordHash: user.passwordHash,
        office: membership.office,
        accountId: membership.id,
        workspace: membership.workspace,
        membershipStatus: membership.status,
      };
    }

    async findByMembership(
      userId: string,
      accountId: string,
      workspace: Workspace,
    ): Promise<MembershipAuthUser> {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          passwordHash: true,
          memberships: {
            where: { id: accountId, workspace },
            take: 1,
            select: {
              id: true,
              workspace: true,
              role: true,
              status: true,
              office: { select: { id: true, name: true } },
            },
          },
        },
      });
      const membership = user?.memberships[0];
      if (!user || !membership) throw new UnauthorizedException('Membership not found');
      if (user.status === 'INACTIVE' || membership.status === 'INACTIVE') {
        throw new ForbiddenException('Account membership is inactive. Please contact admin.');
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: membership.role,
        status: user.status,
        hasPassword: !!user.passwordHash,
        passwordHash: user.passwordHash,
        office: membership.office,
        accountId: membership.id,
        workspace: membership.workspace,
        membershipStatus: membership.status,
      };
    }

    async listMemberships(userId: string) {
      return this.prisma.accountMembership.findMany({
        where: { userId },
        orderBy: { workspace: 'asc' },
        select: {
          id: true, workspace: true, role: true, status: true,
          office: { select: { id: true, name: true } },
          createdAt: true, updatedAt: true,
        },
      });
    }

    private async syncWorkspaceMemberships(
      tx: Prisma.TransactionClient,
      data: {
        userId: string;
        role: Role;
        officeId: string | null;
        status: UserStatus;
        syncRole: boolean;
      },
    ) {
      return Promise.all(
        [Workspace.RBAP, Workspace.QM].map((workspace) =>
          tx.accountMembership.upsert({
            where: {
              userId_workspace: { userId: data.userId, workspace },
            },
            update: {
              officeId: data.officeId,
              status: data.status,
              ...(data.syncRole ? { role: data.role } : {}),
            },
            create: {
              userId: data.userId,
              workspace,
              role: data.role,
              officeId: data.officeId,
              status: data.status,
            },
            select: {
              id: true,
              userId: true,
              workspace: true,
              role: true,
              status: true,
              office: { select: { id: true, name: true } },
              createdAt: true,
              updatedAt: true,
            },
          }),
        ),
      );
    }

    async syncMemberships(userId: string) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, officeId: true, status: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return this.prisma.$transaction((tx) =>
        this.syncWorkspaceMemberships(tx, {
          userId: user.id,
          role: user.role,
          officeId: user.officeId,
          status: user.status,
          syncRole: true,
        }),
      );
    }

    async createMembership(data: {
      userId: string; workspace: Workspace; role: Role; officeId?: string | null;
    }) {
      const user = await this.checkUserById(data.userId);
      if (!user) throw new NotFoundException('User not found');
      return this.prisma.accountMembership.create({
        data,
        select: {
          id: true, userId: true, workspace: true, role: true, status: true,
          office: { select: { id: true, name: true } },
          createdAt: true, updatedAt: true,
        },
      });
    }

    async updateMembership(id: string, data: { role?: Role; officeId?: string | null; status?: 'ACTIVE' | 'INACTIVE' }) {
      try {
        return await this.prisma.accountMembership.update({
          where: { id },
          data,
          select: {
            id: true, userId: true, workspace: true, role: true, status: true,
            office: { select: { id: true, name: true } },
            createdAt: true, updatedAt: true,
          },
        });
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new NotFoundException('Membership not found');
        }
        throw error;
      }
    }

  async setPasswordHash(userId: string, passwordHash: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        passwordHash: true,
        office: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return this.mapAuthUser(user);
  }

  async changeStatus(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, officeId: true, status: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const status = user.status === 'ACTIVE' ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status },
        select: managedUserSelect,
      });
      await this.syncWorkspaceMemberships(tx, {
        userId: user.id,
        role: user.role,
        officeId: user.officeId,
        status,
        syncRole: true,
      });
      return updated;
    });
  }

  async softDelete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        status: true,
        headOfOffice: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (tx) => {
      if (user.headOfOffice?.id) {
        await tx.office.update({
          where: { id: user.headOfOffice.id },
          data: { headId: null },
        });
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          officeId: null,
        },
        select: managedUserSelect,
      });
      await this.syncWorkspaceMemberships(tx, {
        userId: user.id,
        role: user.role,
        officeId: null,
        status: UserStatus.INACTIVE,
        syncRole: true,
      });
      return updated;
    });
  }

  //assign user to office
  async assignToOffice(userId: string, officeId?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        headOfOffice: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    const normalizedOfficeId = officeId?.trim();

    if (!normalizedOfficeId) {
      return this.prisma.$transaction(async (tx) => {
        if (user.headOfOffice?.id) {
          await tx.office.update({
            where: { id: user.headOfOffice.id },
            data: { headId: null },
          });
        }

        const updated = await tx.user.update({
          where: { id: userId },
          data: { officeId: null },
          select: managedUserSelect,
        });
        await this.syncWorkspaceMemberships(tx, {
          userId,
          role: user.role,
          officeId: null,
          status: user.status,
          syncRole: false,
        });
        return updated;
      });
    }

    const office = await this.prisma.office.findUnique({
      where: { id: normalizedOfficeId },
    });

    if (!office) throw new NotFoundException('Office not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { officeId: normalizedOfficeId },
        select: managedUserSelect,
      });
      await this.syncWorkspaceMemberships(tx, {
        userId,
        role: user.role,
        officeId: normalizedOfficeId,
        status: user.status,
        syncRole: false,
      });
      return updated;
    });
  }

  async changeUserRole(userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, officeId: true, status: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (!isValidRole(role)) throw new BadRequestException('Invalid role');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { role },
        select: managedUserSelect,
      });
      await this.syncWorkspaceMemberships(tx, {
        userId,
        role,
        officeId: user.officeId,
        status: user.status,
        syncRole: true,
      });
      return updated;
    });
  }

  async assignSupervisor(userId: string, supervisorId?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalizedSupervisorId = supervisorId?.trim() || null;
    await this.ensureValidSupervisor(
      user.role,
      normalizedSupervisorId,
      user.id,
    );

    return this.prisma.user.update({
      where: { id: userId },
      data: { supervisorId: normalizedSupervisorId },
      select: managedUserSelect,
    });
  }

  async findAllWithoutOffice() {
    return await this.prisma.user.findMany({
      where: {
        officeId: null,
        status: 'ACTIVE',
      },
      orderBy: { name: 'asc' },
      select: managedUserSelect,
    });
  }

  async count() {
    return await this.prisma.user.count();
  }

  private async ensureValidSupervisor(
    role: Role,
    supervisorId: string | null | undefined,
    userId?: string,
  ) {
    const allowedRoles = supervisorRolesByRole[role];

    if (!supervisorId) {
      if (allowedRoles.length > 0) {
        throw new BadRequestException(
          `${role.replace(/_/g, ' ')} users must have an assigned supervisor.`,
        );
      }
      return;
    }

    if (userId && supervisorId === userId) {
      throw new BadRequestException('A user cannot supervise themselves.');
    }

    const supervisor = await this.prisma.user.findUnique({
      where: { id: supervisorId },
      select: { id: true, name: true, role: true, status: true },
    });

    if (!supervisor || supervisor.status !== 'ACTIVE') {
      throw new BadRequestException(
        'The selected supervisor must be an active user.',
      );
    }

    if (!allowedRoles.includes(supervisor.role)) {
      throw new BadRequestException(
        `${role.replace(/_/g, ' ')} users can only report to: ${allowedRoles
          .map((allowedRole) => allowedRole.replace(/_/g, ' '))
          .join(', ')}.`,
      );
    }
  }
}
