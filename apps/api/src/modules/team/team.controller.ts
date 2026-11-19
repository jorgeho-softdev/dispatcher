import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  acceptInvitationSchema,
  invitationCreateSchema,
  memberUpdateSchema,
  type AcceptInvitationInput,
  type InvitationCreateInput,
  type MemberUpdateInput,
} from '@dispatcher/shared';
import { Auth, Public, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthContext } from '../../common/auth-context';
import { TeamService } from './team.service';

const tokenQuery = z.object({ token: z.string().min(20).max(200) });

@ApiTags('team')
@Controller()
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @ApiBearerAuth()
  @Get('members')
  @RequirePermission('vehicles:read')
  listMembers(@Auth() auth: AuthContext) {
    return this.team.listMembers(auth);
  }

  @ApiBearerAuth()
  @Patch('members/:id')
  @RequirePermission('members:manage')
  updateRole(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(memberUpdateSchema)) body: MemberUpdateInput,
  ) {
    return this.team.updateRole(auth, id, body);
  }

  @ApiBearerAuth()
  @Delete('members/:id')
  @RequirePermission('members:manage')
  removeMember(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.team.removeMember(auth, id);
  }

  @ApiBearerAuth()
  @Get('invitations')
  @RequirePermission('members:manage')
  listInvitations(@Auth() auth: AuthContext) {
    return this.team.listInvitations(auth);
  }

  @ApiBearerAuth()
  @Post('invitations')
  @RequirePermission('members:manage')
  createInvitation(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(invitationCreateSchema))
    body: InvitationCreateInput,
  ) {
    return this.team.createInvitation(auth, body);
  }

  @ApiBearerAuth()
  @Delete('invitations/:id')
  @HttpCode(204)
  @RequirePermission('members:manage')
  async revokeInvitation(
    @Auth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.team.revokeInvitation(auth, id);
  }

  @Public()
  @Get('invitations/preview')
  preview(@Query(new ZodValidationPipe(tokenQuery)) query: { token: string }) {
    return this.team.preview(query.token);
  }

  @Public()
  @Post('invitations/accept')
  @HttpCode(200)
  accept(
    @Body(new ZodValidationPipe(acceptInvitationSchema))
    body: AcceptInvitationInput,
  ) {
    return this.team.accept(body);
  }
}
