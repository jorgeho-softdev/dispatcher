import { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/theme';

// One tappable/static row inside a settings Card. Pass `right` for a custom
// control (e.g. a Switch); otherwise a chevron is shown when tappable.
export function SettingRow({
  label,
  value,
  onPress,
  right,
  destructive = false,
  last = false,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      className={`flex-row items-center justify-between px-4 py-4 ${last ? '' : 'border-b border-border'}`}
    >
      <Text className={`font-sans-medium text-base ${destructive ? 'text-danger' : 'text-ink'}`}>
        {label}
      </Text>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {value && <Text className="font-sans text-sm text-muted">{value}</Text>}
        {right ?? (onPress && <Ionicons name="chevron-forward" size={18} color={colors.mutedLight} />)}
      </View>
    </TouchableOpacity>
  );
}
