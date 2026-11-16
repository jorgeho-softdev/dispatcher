import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { DEFAULT_LOCALE, isLocale } from '@dispatcher/i18n';
import type {
  AcceptInvitationInput,
  InvitationCreateInput,
  InvitationDto,
  InvitationPreviewDto,
  MemberDto,
  MemberUpdateInput,
} from '@dispatcher/shared';
import { apiError } from '../../common/api-error';
import type { AuthContext } from '../../common/auth-context';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { Invitation, Membership } from '../../generated/prisma/client';

const INVITATION_TTL_DAYS = 7;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Members of an organization and invitations by link (docs/team.md).
 * Invariants: an organization always keeps at least one owner; nobody
 * changes their own role; only owners grant or revoke ownership.
 */
@Injectable()
export class TeamService {
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
  }

  async listMembers(auth: AuthContext): Promise<MemberDto[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId: auth.organizationId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      isSelf: m.userId === auth.userId,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async updateRole(
    auth: AuthContext,
    membershipId: string,
    input: MemberUpdateInput,
  ): Promise<MemberDto[]> {
    const target = await this.findMembership(auth, membershipId);
    if (target.userId === auth.userId)
      throw new BadRequestException(
        apiError('CANNOT_CHANGE_SELF', 'Cannot change your own role'),
      );
    this.assertOwnershipChangeAllowed(auth, target, input.role);
    if (target.role === 'owner' && input.role !== 'owner')
      await this.assertNotLastOwner(auth.organizationId);
    await this.prisma.membership.update({
      where: { id: target.id },
      data: { role: input.role },
    });
    // Existing access tokens carry the old role for ≤15 min; refresh picks up the new one.
    return this.listMembers(auth);
  }

  async removeMember(
    auth: AuthContext,
    membershipId: string,
  ): Promise<MemberDto[]> {
    const target = await this.findMembership(auth, membershipId);
    if (target.userId === auth.userId)
      throw new BadRequestException(
        apiError('CANNOT_CHANGE_SELF', 'Cannot remove yourself'),
      );
    this.assertOwnershipChangeAllowed(auth, target, null);
    if (target.role === 'owner')
      await this.assertNotLastOwner(auth.organizationId);
    await this.prisma.$transaction([
      this.prisma.membership.delete({ where: { id: target.id } }),
      // Sign them out everywhere (single-organization users in this phase).
      this.prisma.refreshToken.updateMany({
        where: { userId: target.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return this.listMembers(auth);
  }

  // ── Invitations ───────────────────────────────────────────────────────

  async createInvitation(
    auth: AuthContext,
    input: InvitationCreateInput,
  ): Promise<InvitationDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      // Multi-organization accounts arrive later; today an email belongs to one organization.
      throw new ConflictException(
        apiError('AUTH_EMAIL_TAKEN', 'Email already registered'),
      );
    }
    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: auth.organizationId,
        email: input.email,
        role: input.role,
        tokenHash: sha256(token),
        invitedById: auth.userId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
      },
    });
    return {
      ...this.toInvitationDto(invitation),
      inviteUrl: `${this.webUrl}/invite?token=${token}`,
    };
  }

  async listInvitations(auth: AuthContext): Promise<InvitationDto[]> {
    const rows = await this.prisma.invitation.findMany({
      where: {
        organizationId: auth.organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((i) => this.toInvitationDto(i));
  }

  async revokeInvitation(auth: AuthContext, id: string): Promise<void> {
    const res = await this.prisma.invitation.updateMany({
      where: {
        id,
        organizationId: auth.organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (res.count === 0)
      throw new NotFoundException(
        apiError('NOT_FOUND', 'Invitation not found'),
      );
  }

  /** Public: shown on the invite page. Doesn't reveal anything for bad tokens. */
  async preview(token: string): Promise<InvitationPreviewDto> {
    const inv = await this.findValidInvitation(token);
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: inv.organizationId },
    });
    return {
      organizationName: org.name,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
    };
  }

  /** Public: creates the account + membership. The caller then logs in normally. */
  async accept(input: AcceptInvitationInput): Promise<{ email: string }> {
    const inv = await this.findValidInvitation(input.token);
    const passwordHash = await hash(input.password);
    await this.prisma.$transaction(async (tx) => {
      // Atomic claim: a token can only be used once, even under races.
      const claimed = await tx.invitation.updateMany({
        where: { id: inv.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0)
        throw new BadRequestException(
          apiError('INVITATION_INVALID', 'Invitation already used'),
        );
      if (await tx.user.findUnique({ where: { email: inv.email } })) {
        throw new ConflictException(
          apiError('AUTH_EMAIL_TAKEN', 'Email already registered'),
        );
      }
      const user = await tx.user.create({
        data: {
          email: inv.email,
          name: input.name,
          passwordHash,
          locale: isLocale(input.locale) ? input.locale : DEFAULT_LOCALE,
        },
      });
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: inv.organizationId,
          role: inv.role,
        },
      });
    });
    return { email: inv.email };
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private async findValidInvitation(token: string): Promise<Invitation> {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) {
      throw new BadRequestException(
        apiError('INVITATION_INVALID', 'Invalid or expired invitation'),
      );
    }
    return inv;
  }

  private async findMembership(
    auth: AuthContext,
    id: string,
  ): Promise<Membership> {
    const m = await this.prisma.membership.findFirst({
      where: { id, organizationId: auth.organizationId },
    });
    if (!m)
      throw new NotFoundException(apiError('NOT_FOUND', 'Member not found'));
    return m;
  }

  /** Only owners touch ownership (grant it, revoke it, or remove an owner). */
  private assertOwnershipChangeAllowed(
    auth: AuthContext,
    target: Membership,
    newRole: string | null,
  ) {
    const touchesOwnership = target.role === 'owner' || newRole === 'owner';
    if (touchesOwnership && auth.role !== 'owner') {
      throw new ForbiddenException(
        apiError('FORBIDDEN', 'Only owners can change ownership'),
      );
    }
  }

  private async assertNotLastOwner(organizationId: string) {
    const owners = await this.prisma.membership.count({
      where: { organizationId, role: 'owner' },
    });
    if (owners <= 1)
      throw new BadRequestException(
        apiError('LAST_OWNER', 'An organization needs at least one owner'),
      );
  }

  private toInvitationDto(i: Invitation): InvitationDto {
    return {
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    };
  }
}
