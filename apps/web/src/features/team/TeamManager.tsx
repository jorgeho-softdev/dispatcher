'use client';

import { useState, type FormEvent } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ROLES, can, invitationCreateSchema, toErrorCode, type InvitationDto, type Role } from '@dispatcher/shared';
import {
  useCreateInvitationMutation,
  useGetInvitationsQuery,
  useGetMeQuery,
  useGetMembersQuery,
  useRemoveMemberMutation,
  useRevokeInvitationMutation,
  useUpdateMemberRoleMutation,
} from '@/lib/store/api';
import { Badge, Button, Card, ErrorState, Input, Label, PageHeader, Select } from '@/components/ui';

const INVITABLE: Role[] = ['fleet_manager', 'dispatcher', 'driver'];

/** Members, roles and invitation links (docs/team.md). */
export function TeamManager() {
  const t = useTranslations();
  const format = useFormatter();
  const { data: me } = useGetMeQuery();
  const canManage = can(me?.role, 'members:manage');
  const { data: members, isError } = useGetMembersQuery();
  const { data: invitations } = useGetInvitationsQuery(undefined, { skip: !canManage });
  const [updateRole] = useUpdateMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [createInvitation, { isLoading: inviting }] = useCreateInvitationMutation();
  const [revoke] = useRevokeInvitationMutation();
  const [created, setCreated] = useState<InvitationDto | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = (e: unknown) => setError(t(`errors.${toErrorCode((e as { data?: { code?: unknown } }).data?.code)}`));
  const run = async (p: Promise<{ error?: unknown }>) => {
    setError(null);
    const r = await p;
    if (r.error) report(r.error);
  };

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreated(null);
    setCopied(false);
    const formEl = event.currentTarget;
    const f = new FormData(formEl);
    const parsed = invitationCreateSchema.safeParse({ email: f.get('email'), role: f.get('role') });
    if (!parsed.success) return setError(t('errors.VALIDATION_FAILED'));
    const r = await createInvitation(parsed.data);
    if (r.error) return report(r.error);
    setCreated(r.data);
    formEl.reset();
  }

  if (isError) return <ErrorState message={t('common.loadError')} />;
  // Only owners hand out ownership; the api enforces it too.
  const assignable = (current: Role) => (me?.role === 'owner' ? ROLES : ROLES.filter((r) => r !== 'owner' || current === 'owner'));

  return (
    <>
      <PageHeader title={t('web.team.title')} subtitle={t('web.team.subtitle')} />
      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-start text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('web.team.members')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('web.team.role')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members?.map((m) => (
                <tr key={m.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {m.name} {m.isSelf && <Badge tone="primary">{t('web.team.you')}</Badge>}
                    </p>
                    <p className="text-xs text-muted">{m.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && !m.isSelf && (me?.role === 'owner' || m.role !== 'owner') ? (
                      <Select
                        aria-label={t('web.team.role')}
                        value={m.role}
                        onChange={(e) => void run(updateRole({ id: m.id, role: e.target.value as Role }))}
                      >
                        {assignable(m.role).map((r) => (
                          <option key={r} value={r}>
                            {t(`domain.role.${r}`)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      t(`domain.role.${m.role}`)
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {canManage && !m.isSelf && (me?.role === 'owner' || m.role !== 'owner') && (
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (window.confirm(t('web.team.removeConfirm', { name: m.name }))) void run(removeMember(m.id));
                        }}
                      >
                        {t('web.team.remove')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {canManage && (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-1 font-semibold">{t('web.team.invite')}</h2>
              <p className="mb-4 text-xs text-muted">{t('web.team.emailNote')}</p>
              <form onSubmit={onInvite} className="space-y-3" noValidate>
                <div>
                  <Label htmlFor="email">{t('web.team.email')}</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="role">{t('web.team.role')}</Label>
                  <Select id="role" name="role" defaultValue="driver" className="w-full">
                    {INVITABLE.map((r) => (
                      <option key={r} value={r}>
                        {t(`domain.role.${r}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={inviting}>
                  {t('web.team.createLink')}
                </Button>
              </form>
              {created?.inviteUrl && (
                <div className="mt-4 rounded-xl border border-primary bg-primary-light p-3">
                  <p className="text-xs">{t('web.team.linkReady', { email: created.email })}</p>
                  <div className="mt-2 flex gap-2">
                    <Input readOnly value={created.inviteUrl} onFocus={(e) => e.currentTarget.select()} aria-label={t('web.team.invite')} />
                    <Button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(created.inviteUrl!).then(() => setCopied(true))}
                    >
                      {copied ? t('web.team.copied') : t('web.team.copy')}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold">{t('web.team.pending')}</h2>
              {invitations?.length === 0 && <p className="text-sm text-muted">{t('web.team.noPending')}</p>}
              <ul className="divide-y divide-border text-sm">
                {invitations?.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {i.email}
                      <span className="block text-xs text-muted">
                        {t(`domain.role.${i.role}`)} ·{' '}
                        {t('web.team.expires', { date: format.dateTime(new Date(i.expiresAt), { day: 'numeric', month: 'short' }) })}
                      </span>
                    </span>
                    <Button variant="danger" onClick={() => void run(revoke(i.id))}>
                      {t('web.team.revoke')}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
