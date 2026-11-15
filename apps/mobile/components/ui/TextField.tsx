import { Text, TextInput, TextInputProps, View } from 'react-native';
import { useColors } from '@/lib/theme';

export function TextField({ label, className, ...props }: TextInputProps & { label: string; className?: string }) {
  const colors = useColors();
  return (
    <View className={className}>
      <Text className="mb-1.5 font-sans-medium text-xs text-muted">{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedLight}
        className="h-12 rounded-xl border border-border bg-surface px-4 font-sans text-base text-ink"
        {...props}
      />
    </View>
  );
}
