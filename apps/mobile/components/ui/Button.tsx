import { ActivityIndicator, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'danger';

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-primary',
  secondary: 'border border-border bg-surface',
  danger: 'bg-danger',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-ink',
  danger: 'text-white',
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  className,
  onPress,
  ...rest
}: TouchableOpacityProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
}) {
  const colors = useColors();
  const inactive = disabled || loading;

  return (
    <TouchableOpacity
      disabled={inactive}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      className={`h-12 flex-row items-center justify-center rounded-xl px-5 ${CONTAINER[variant]} ${inactive ? 'opacity-50' : ''} ${className ?? ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.ink} />
      ) : (
        <Text className={`font-sans-bold text-sm uppercase ${LABEL[variant]}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
