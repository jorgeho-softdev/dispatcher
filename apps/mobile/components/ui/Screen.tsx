import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Standard page wrapper: safe-area top padding + horizontal gutter, and an
// optional ScrollView. Keeps spacing identical across screens.
export function Screen({
  children,
  scroll = true,
  className,
}: {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
}) {
  const insets = useSafeAreaInsets();
  const style = { paddingTop: insets.top + 12 };

  if (!scroll) {
    return (
      <View className={`flex-1 bg-background px-5 ${className ?? ''}`} style={style}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName={`px-5 pb-10 ${className ?? ''}`}
      contentContainerStyle={style}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
