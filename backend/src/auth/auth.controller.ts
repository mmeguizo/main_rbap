import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
// 'import type' is required here because isolatedModules + emitDecoratorMetadata are enabled.
// Using 'import type' means this import is erased at runtime — it is only used for type-checking.
import type { Response } from 'express';
import {
  ApiTags,
  ApiExcludeEndpoint,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
} from '@nestjs/swagger';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import {
  DevLoginDto,
  PasswordLoginDto,
  SetPasswordDto,
  RegisterDto,
  WorkspaceSelectionDto,
} from './auth.dto';
import { HttpCode, HttpStatus } from '@nestjs/common';
import { getDto } from './dto/get.dto';
import type { GoogleAuthLookupResult } from '../users/users.service';
import { AuthenticatedUser } from './types/authenticated-user.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiExcludeEndpoint()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleLogin() {}

  @ApiExcludeEndpoint()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  googleCallback(
    @Req() req: Request & { user: GoogleAuthLookupResult },
    @Res() res: Response,
  ) {
    // Read the frontend URL from environment — defaults to localhost:5173 for React dev
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    if (req.user.kind === 'registration_required') {
      const registrationToken = this.authService.issueGoogleRegistrationToken(
        req.user.registration,
      );

      const registerUrl =
        `${frontendUrl}/register` +
        `?registration_token=${encodeURIComponent(registrationToken)}`;

      return res.redirect(registerUrl);
    }

    // Issue JWT access + refresh tokens for the authenticated Google user
    const tokens = this.authService.login(req.user.user);

    // Redirect the browser to the React auth callback page.
    // Tokens are passed as query params so the frontend can read and store them.
    // URL format: http://localhost:5173/auth/callback?access_token=xxx&refresh_token=yyy
    const callbackUrl =
      `${frontendUrl}/auth/callback` +
      `?access_token=${tokens.access_token}` +
      `&refresh_token=${tokens.refresh_token}`;

    return res.redirect(callbackUrl);
  }

  @ApiExcludeEndpoint()
  @Get('google-registration-context')
  @HttpCode(HttpStatus.OK)
  getGoogleRegistrationContext(@Query('token') token: string) {
    return this.authService.getGoogleRegistrationContext(token);
  }

  @ApiBearerAuth() // ← this tells Swagger to send the token
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  getMe(@Req() req: Request & { user: getDto }): getDto {
    return req.user;
  }

  @ApiOperation({
    summary:
      'DEV ONLY — enter your @chmsu.edu.ph email to get a token or use mine',
  })
  @ApiBody({
    schema: {
      properties: {
        email: { type: 'string', example: 'mark.meguizo@chmsu.edu.ph' },
      },
    },
  })
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin(@Body() dto: DevLoginDto) {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Dev login is only allowed in development mode');
    }
    return this.authService.devLogin(dto.email, dto.workspace);
  }

  @ApiOperation({
    summary:
      'Login using a previously set password after the account was created through Google.',
  })
  @ApiBody({ type: PasswordLoginDto })
  @Post('password-login')
  @HttpCode(HttpStatus.OK)
  passwordLogin(@Body() dto: PasswordLoginDto) {
    return this.authService.passwordLogin(dto.email, dto.password, dto.workspace);
  }

  @ApiOperation({
    summary: 'Register a new account with a CHMSU email address.',
  })
  @ApiBody({ type: RegisterDto })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Set or replace the password for the currently signed-in user so future logins can use email and password.',
  })
  @ApiBody({ type: SetPasswordDto })
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  setPassword(
    @Body() dto: SetPasswordDto,
    @Req() req: Request & { user: getDto },
  ) {
    return this.authService.setPassword(req.user.id, dto.password);
  }

  // AuthController
  @ApiOperation({
    summary:
      'refresh access token using a refresh token. Use the same refresh token you got from /dev-login or /google/callback',
  })
  @ApiBody({
    schema: {
      properties: {
        refresh_token: { type: 'string', example: 'your_refresh_token_here' },
      },
    },
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Switch to another account workspace.' })
  @ApiBody({ type: WorkspaceSelectionDto })
  @Post('switch-workspace')
  @HttpCode(HttpStatus.OK)
  switchWorkspace(
    @Body() dto: WorkspaceSelectionDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.authService.switchWorkspace(
      req.user.id,
      req.user.email,
      dto.workspace,
    );
  }
}
