---
description: 'Use when writing, reviewing, or editing TypeScript files in this NestJS project. Covers NestJS patterns, Prisma usage, DTO validation, Guards, and REST controller conventions.'
applyTo: 'src/**/*.ts'
---

# NestJS TypeScript File Standards

## Controller Rules

- Controllers only receive requests and return responses — zero business logic.
- Always call a Service method and return its result.
- Always use `@HttpCode()` for non-200 responses (e.g., 201 for create).

```ts
// Correct pattern
@Post()
@HttpCode(201)
create(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}
```

## Service Rules

- All business logic lives here.
- Always use `async/await` with `try/catch`.
- Inject `PrismaService` — never import `PrismaClient` directly in services.

```ts
// Correct pattern
constructor(private readonly prisma: PrismaService) {}
```

## DTO Rules

- Every incoming request body needs a DTO class.
- Always use `class-validator` decorators.
- Never use raw `any` or plain objects as input types.

```ts
import { IsString, IsEmail, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

## Prisma Query Rules

- Import PrismaClient from `../../generated/prisma` (non-standard output path for this project).
- Always use `select` to exclude sensitive fields like `password`.
- Always add `take` and `skip` to `findMany()` — never return an unbounded list.
- Use `prisma.$transaction()` when doing multi-step writes.

```ts
// Correct: paginated, no password exposed
const users = await this.prisma.user.findMany({
  take: 10,
  skip: 0,
  select: { id: true, email: true, role: true },
});
```

## Guard Usage

- Use `@UseGuards(JwtAuthGuard)` on any route that requires login.
- Use `@UseGuards(JwtAuthGuard, RolesGuard)` with `@Roles(Role.ADMIN)` for role-protected routes.
- Public routes must be explicitly marked with a `@Public()` decorator.

## Error Handling

- Throw NestJS built-in exceptions — never throw plain `Error`.
- Common ones: `NotFoundException`, `UnauthorizedException`, `ForbiddenException`, `BadRequestException`.

```ts
if (!user) throw new NotFoundException('User not found');
```
