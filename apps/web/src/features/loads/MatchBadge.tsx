'use client';

import { useTranslations } from 'next-intl';
import type { LoadDto } from '@dispatcher/shared';

/** "★ 98% Match" pill; colour follows the score band. */
export function MatchBadge({ match }: { match: LoadDto['match'] }) {
  const t = useTranslations('domain');
  if (!match) return null;
  const tone = !match.compatible
    ? 'bg-danger/15 text-danger'
    : match.score >= 85
      ? 'bg-primary text-on-primary'
      : match.score >= 70
        ? 'bg-primary-light text-primary'
        : 'bg-surface-raised text-muted';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${tone}`}>
      ★ {t('match', { score: match.score })}
    </span>
  );
}
