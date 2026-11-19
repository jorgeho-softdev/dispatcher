import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { useTranslations } from 'use-intl';
import { LOAD_VIEWS, type LoadView } from '@dispatcher/shared';

/** Recomendadas / Cerca de mí / Todas chips (mockup). */
export function LoadViewTabs({ value, onChange }: { value: LoadView; onChange: (v: LoadView) => void }) {
  const t = useTranslations('domain.loadView');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 grow-0" contentContainerStyle={{ gap: 8 }}>
      {LOAD_VIEWS.map((v) => {
        const selected = v === value;
        return (
          <TouchableOpacity
            key={v}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(v)}
            className={`rounded-full border px-4 py-2 ${selected ? 'border-primary bg-primary' : 'border-border bg-surface'}`}
          >
            <Text className={`font-sans-semibold text-sm ${selected ? 'text-on-primary' : 'text-ink'}`}>{t(v)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
