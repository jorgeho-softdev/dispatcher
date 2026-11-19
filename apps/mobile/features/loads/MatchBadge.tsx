import { Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import type { LoadDto } from '@dispatcher/shared';

/** "★ 98% Match" pill (mockup); colour follows the score band. */
export function MatchBadge({ match }: { match: LoadDto['match'] }) {
  const t = useTranslations('domain');
  if (!match) return null;
  const strong = match.compatible && match.score >= 85;
  const good = match.compatible && match.score >= 70;
  return (
    <View
      className={`self-start rounded-full px-2.5 py-1 ${
        !match.compatible ? 'bg-danger/15' : strong ? 'bg-primary' : good ? 'bg-primary-light' : 'bg-border'
      }`}
    >
      <Text
        className={`font-sans-bold text-[11px] ${
          !match.compatible ? 'text-danger' : strong ? 'text-on-primary' : good ? 'text-primary' : 'text-muted'
        }`}
      >
        ★ {t('match', { score: match.score })}
      </Text>
    </View>
  );
}
