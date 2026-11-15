import { Text, View } from 'react-native';
import { useFormatter, useTranslations } from 'use-intl';
import { formatMoney, type NegotiationDetailDto } from '@dispatcher/shared';
import { Card } from '@/components/ui/Card';
import { useIntlLocale } from '@/lib/use-intl-locale';
import { useExplain } from './useExplain';

const DOT: Record<string, string> = { ai: 'bg-primary', user: 'bg-info', broker: 'bg-warning', system: 'bg-muted' };

/** Audit trail of the negotiation, newest first. */
export function Timeline({ negotiation }: { negotiation: NegotiationDetailDto }) {
  const t = useTranslations();
  const format = useFormatter();
  const intlLocale = useIntlLocale();
  const explain = useExplain();

  return (
    <Card>
      {[...negotiation.events].reverse().map((e, i, all) => (
        <View key={e.id} className={`flex-row ${i < all.length - 1 ? 'pb-4' : ''}`} style={{ gap: 12 }}>
          <View className={`mt-1.5 h-2.5 w-2.5 rounded-full ${DOT[e.actor] ?? 'bg-muted'}`} />
          <View className="flex-1">
            <View className="flex-row items-baseline justify-between" style={{ gap: 8 }}>
              <Text className="flex-1 font-sans-semibold text-sm text-ink">
                {t(`domain.negotiationEvent.${e.type}`)}
                {e.amount !== null && ` · ${formatMoney(e.amount, negotiation.currency, intlLocale)}`}
              </Text>
              <Text className="font-sans text-[11px] text-muted-light">
                {format.dateTime(new Date(e.createdAt), { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </View>
            {e.actor === 'ai' && explain(e) && <Text className="mt-0.5 font-sans text-xs text-muted">{explain(e)}</Text>}
            {e.brokerMessage && (
              <Text className="mt-1 font-sans text-xs italic text-muted">
                {e.actor === 'broker' ? t('negotiation.brokerMessage') : t('negotiation.messageToBroker')}: “{e.brokerMessage}”
              </Text>
            )}
          </View>
        </View>
      ))}
    </Card>
  );
}
