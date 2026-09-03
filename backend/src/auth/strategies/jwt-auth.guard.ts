import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { Workspace } from '@prisma/client';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    accountId?: string;
    workspace?: Workspace;
  }) {
    const user = payload.accountId && payload.workspace
      ? await this.usersService.findByMembership(payload.sub, payload.accountId, payload.workspace)
      : await this.usersService.findMembershipLoginUserByEmail(payload.email, Workspace.RBAP);
    if (!user) throw new UnauthorizedException('User not found');
    const {
      passwordHash: _passwordHash,
      membershipStatus,
      ...safeUser
    } = user;
    return {
      ...safeUser,
      account: {
        id: user.accountId,
        workspace: user.workspace,
        role: user.role,
        status: membershipStatus,
        office: user.office,
      },
    };
  }
}
