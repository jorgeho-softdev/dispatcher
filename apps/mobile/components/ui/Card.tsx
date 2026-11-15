import { View, ViewProps } from 'react-native';

export function Card({
  className,
  padded = true,
  children,
  ...rest
}: ViewProps & { className?: string; padded?: boolean }) {
  return (
    <View
      className={`rounded-card border border-border bg-surface overflow-hidden ${padded ? 'p-4' : ''} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </View>
  );
}
