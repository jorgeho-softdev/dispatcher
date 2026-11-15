import { Text, View } from 'react-native';

type Tone = 'primary' | 'warning' | 'neutral';

const CONTAINER: Record<Tone, string> = {
  primary: 'bg-primary-light',
  warning: 'bg-warning/15',
  neutral: 'bg-border',
};

const LABEL: Record<Tone, string> = {
  primary: 'text-primary',
  warning: 'text-warning',
  neutral: 'text-muted',
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${CONTAINER[tone]}`}>
      <Text className={`font-sans-bold text-[10px] uppercase ${LABEL[tone]}`}>{label}</Text>
    </View>
  );
}
