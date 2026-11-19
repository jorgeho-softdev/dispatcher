import { useTranslations } from 'use-intl';
import type { NegotiationEventDto } from '@dispatcher/shared';

/** LLM rationale (already in the user's language) or the translated reason code. */
export function useExplain() {
  const t = useTranslations('domain.aiReason');
  return (event: NegotiationEventDto | null): string | null => {
    if (!event) return null;
    if (event.rationale) return event.rationale;
    if (event.reasonCode) return t(event.reasonCode, event.reasonParams ?? {});
    return null;
  };
}
