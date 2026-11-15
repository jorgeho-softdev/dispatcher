import { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/theme';
import { useDebouncedPush } from '@/lib/nav';

// Shared top row for every screen: title on the left, Settings shortcut on
// the right (or a back button with `showBack`). A single component keeps
// headers from drifting out of sync between screens. `rightExtra` lets one
// screen add its own action without every other screen picking it up.
export function ScreenHeader({
  title,
  showBack = false,
  showSettings = true,
  rightExtra,
}: {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
  rightExtra?: ReactNode;
}) {
  const router = useRouter();
  const push = useDebouncedPush();
  const colors = useColors();

  return (
    <View className="mb-5 flex-row items-center justify-between">
      <View className="flex-1 flex-row items-center" style={{ gap: 10 }}>
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
        )}
        <Text className="flex-1 font-sans-bold text-3xl text-ink" numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        {rightExtra}
        {showSettings && (
          <TouchableOpacity
            onPress={() => push('/settings')}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <Ionicons name="settings-outline" size={20} color={colors.ink} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
