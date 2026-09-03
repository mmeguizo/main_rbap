import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { hash, compare } from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './auth.dto';
import { Workspace } from '@prisma/client';

const PASSWORD_SALT_ROUNDS = 10;
const GOOGLE_REGISTRATION_TOKEN_TYPE = 'google-registration';
const GOOGLE_REGISTRATION_TOKEN_TTL = '10m';

type LoginUser = {
  id: string;
  email: string;
  role: string;
  status?: string;
  accountId?: string;
  workspace?: Workspace;
  office?: { id: string; name: string } | null;
};

type GoogleRegistrationPayload = {
  type: typeof GOOGLE_REGISTRATION_TOKEN_TYPE;
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  login(user: LoginUser) {
    if (user.status) {
      this.ensureEligibleLoginUser(user.status);
    }

    return this.issueTokens(user);
  }

  async devLogin(email: string, workspace: Workspace = Workspace.RBAP) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundException(
        `No user found with email: ${normalizedEmail}. Login with Google first.`,
      );
    }
    const membershipUser = await this.usersService.findMembershipLoginUserByEmail(
      normalizedEmail,
      workspace,
    );
    if (!membershipUser) {
      throw new ForbiddenException(`No ${workspace} membership exists for this account.`);
    }
    this.ensureEligibleLoginUser(membershipUser.status);
    this.logger.log(`Dev login: ${user.id} (${normalizedEmail})`);
    return this.login(membershipUser);
  }

  async passwordLogin(email: string, password: string, workspace: Workspace = Workspace.RBAP) {
    const normalizedEmail = this.normalizeEmail(email);

    this.ensureChmsuEmail(normalizedEmail);

    const user = await this.usersService.findMembershipLoginUserByEmail(
      normalizedEmail,
      workspace,
    );

    if (!user) {
      throw new NotFoundException(
        'Account not found. Please create an account using the register button.',
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'No password set for this account. Please login using Google or set a password after Google login.',
      );
    }

    if (
      user.workspace !== workspace ||
      user.status === 'INACTIVE' ||
      user.membershipStatus === 'INACTIVE'
    ) {
      throw new ForbiddenException('Account membership is inactive. Please contact admin.');
    }

    const passwordMatches = await compare(password, user.passwordHash);

    if (!passwordMatches) {
      this.logger.warn(`Failed password login attempt for ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    this.logger.log(`Password login: ${user.id} (${normalizedEmail})`);
    return this.login(user);
  }

  async register(dto: RegisterDto) {
    const googleRegistration = this.verifyGoogleRegistrationToken(
      dto.googleRegistrationToken,
    );

    const email = this.normalizeEmail(dto.email);
    this.ensureChmsuEmail(email);

    if (googleRegistration.email !== email) {
      throw new UnauthorizedException(
        'Google verification does not match the provided email address.',
      );
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException(
        'Email is already registered. Please log in.',
      );
    }

    const passwordHash = await hash(dto.password, PASSWORD_SALT_ROUNDS);

    const user = await this.usersService.createWithPassword({
      email,
      name: dto.name.trim(),
      passwordHash,
      googleId: googleRegistration.googleId,
      avatar: googleRegistration.avatar,
    });

    await this.usersService.createMembership({
      userId: user.id,
      workspace: Workspace.RBAP,
      role: 'OFFICE_HEAD',
    });
    await this.usersService.createMembership({
      userId: user.id,
      workspace: Workspace.QM,
      role: 'OFFICE_HEAD',
    });
    return this.login(user);
  }

  issueGoogleRegistrationToken(payload: {
    googleId: string;
    email: string;
    name: string;
    avatar?: string | null;
  }) {
    return this.jwtService.sign(
      {
        type: GOOGLE_REGISTRATION_TOKEN_TYPE,
        googleId: payload.googleId,
        email: this.normalizeEmail(payload.email),
        name: payload.name,
        avatar: payload.avatar ?? null,
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: GOOGLE_REGISTRATION_TOKEN_TTL,
      },
    );
  }

  getGoogleRegistrationContext(token: string) {
    const payload = this.verifyGoogleRegistrationToken(token);

    return {
      email: payload.email,
      name: payload.name,
      avatar: payload.avatar,
    };
  }

  async setPassword(userId: string, password: string) {
    const passwordHash = await hash(password, PASSWORD_SALT_ROUNDS);

    const user = await this.usersService.setPasswordHash(userId, passwordHash);

    this.logger.log(`Password changed for user ${userId}`);
    return {
      message: 'Password saved successfully.',
      hasPassword: user.hasPassword,
    };
  }

  // AuthService
  issueTokens(user: LoginUser) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(user.accountId && { accountId: user.accountId }),
      workspace: user.workspace ?? Workspace.RBAP,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        type: 'refresh',
        ...(user.accountId && { accountId: user.accountId }),
        workspace: user.workspace ?? Workspace.RBAP,
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    // Recommended: hash refreshToken and store hash in DB
    // await this.usersService.saveRefreshTokenHash(user.id, hash(refreshToken));

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  // AuthService.refresh
  async refresh(refreshToken: string) {
    let payload: { sub: string; type: string; accountId?: string; workspace?: Workspace };

    try {
      payload = this.jwtService.verify<{ sub: string; type: string }>(
        refreshToken,
        {
          secret: process.env.JWT_REFRESH_SECRET!,
        },
      );
    } catch {
      this.logger.warn('Invalid refresh token used');
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Recommended: compare refresh token hash from DB before issuing new tokens
    // const isValid = await compareHash(refreshToken, storedHash);

    const user = payload.accountId && payload.workspace
      ? await this.usersService.findByMembership(payload.sub, payload.accountId, payload.workspace)
      : await this.usersService.findById(payload.sub);
    if (!user) {
      throw new NotFoundException(`No user found with id: ${payload.sub}`);
    }
    return this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      accountId: payload.accountId ?? (user as { accountId?: string }).accountId,
      workspace:
        payload.workspace ??
        (user as { workspace?: Workspace }).workspace ??
        Workspace.RBAP,
    });
  }

  async switchWorkspace(userId: string, email: string, workspace: Workspace) {
    const membership = await this.usersService.findMembershipLoginUserByEmail(
      email,
      workspace,
    );

    if (
      !membership ||
      membership.id !== userId ||
      membership.membershipStatus === 'INACTIVE' ||
      membership.status === 'INACTIVE'
    ) {
      throw new ForbiddenException(
        `No active ${workspace} membership exists for this account.`,
      );
    }

    return this.login(membership);
  }

  private ensureChmsuEmail(email: string) {
    if (!email.toLowerCase().endsWith('@chmsu.edu.ph')) {
      throw new UnauthorizedException(
        'Only @chmsu.edu.ph accounts are allowed.',
      );
    }
  }

  private ensureEligibleLoginUser(status: string) {
    if (status === 'INACTIVE') {
      throw new ForbiddenException(
        'Account is inactive. Please contact admin.',
      );
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private verifyGoogleRegistrationToken(
    token: string,
  ): GoogleRegistrationPayload {
    try {
      const payload = this.jwtService.verify<GoogleRegistrationPayload>(token, {
        secret: process.env.JWT_SECRET!,
      });

      if (payload.type !== GOOGLE_REGISTRATION_TOKEN_TYPE) {
        throw new UnauthorizedException(
          'Invalid Google registration verification token.',
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        'Google verification expired. Please sign in with Google again.',
      );
    }
  }
}
