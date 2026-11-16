import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslations } from 'use-intl';
import { TRIP_PROGRESS, type TripStatus } from '@dispatcher/shared';
import { useColors } from '@/lib/theme';

const ORDER: TripStatus[] = ['scheduled', 'at_pickup', 'in_transit', 'delivered', 'completed'];

/** Recogida → En ruta → Entrega (mockup screen 4). */
export function TripStepper({ status }: { status: TripStatus }) {
  const t = useTranslations('domain.tripStep');
  const colors = useColors();
  const current = ORDER.indexOf(status);

  return (
    <View className="flex-row items-start">
      {TRIP_PROGRESS.map((step, i) => {
        const idx = ORDER.indexOf(step);
        const done = current > idx || status === 'completed';
        const active = current === idx;
        return (
          <View key={step} className="flex-1 items-center">
            <View className="w-full flex-row items-center">
              <View className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : done || active ? 'bg-primary' : 'bg-border'}`} />
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  done ? 'bg-primary' : active ? 'border-2 border-primary bg-primary-light' : 'border-2 border-border'
                }`}
              >
                {done ? (
                  <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
                ) : active ? (
                  <Ionicons name="bus" size={16} color={colors.primary} />
                ) : null}
              </View>
              <View
                className={`h-0.5 flex-1 ${i === TRIP_PROGRESS.length - 1 ? 'opacity-0' : done ? 'bg-primary' : 'bg-border'}`}
              />
            </View>
            <Text className={`mt-1 font-sans-semibold text-xs ${active ? 'text-primary' : 'text-muted'}`}>{t(step)}</Text>
          </View>
        );
      })}
    </View>
  );
}
