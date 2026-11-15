import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useAppSelector } from '@/store/hooks';
import { selectCurrentAlert } from '@/store/alert-slice';
import { pressAlertButton } from '@/lib/app-alert';

// Renders whatever's in the alert slice as a themed modal card, styled like
// the rest of the app (rounded-card surface, theme colors) instead of the
// OS-native Alert.alert dialog. Mount once at the app
// root (see app/_layout.tsx) — lib/app-alert.ts's appAlert() is the trigger,
// callable from anywhere the same way Alert.alert used to be.
export function AppAlertHost() {
  const alert = useAppSelector(selectCurrentAlert);

  if (!alert) return null;

  const handlePress = (index: number) => pressAlertButton(alert.id, index);

  const cancelIndex = alert.buttons.findIndex((b) => b.style === 'cancel');
  const backIndex = cancelIndex >= 0 ? cancelIndex : alert.buttons.length - 1;
  const sideBySide = alert.buttons.length === 2;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => handlePress(backIndex)}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-8">
        <View className="w-full max-w-sm rounded-card border border-border bg-surface p-6">
          <Text className="text-center font-sans-bold text-lg text-ink">
            {alert.title}
          </Text>
          {alert.message && (
            <Text className="mt-2 text-center font-sans text-sm text-muted">
              {alert.message}
            </Text>
          )}
          <View className={sideBySide ? 'mt-5 flex-row' : 'mt-5'}>
            {alert.buttons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              const solid = !isCancel;
              return (
                <TouchableOpacity
                  key={`${button.text}-${index}`}
                  onPress={() => handlePress(index)}
                  className={[
                    'items-center justify-center rounded-xl px-4 py-3',
                    sideBySide ? 'flex-1' : 'w-full',
                    sideBySide && index > 0 ? 'ml-3' : '',
                    !sideBySide && index > 0 ? 'mt-3' : '',
                    solid
                      ? isDestructive
                        ? 'bg-danger'
                        : 'bg-primary'
                      : 'border border-border bg-background',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <Text
                    className={`font-sans-bold text-sm uppercase ${
                      solid
                        ? isDestructive
                          ? 'text-white'
                          : 'text-on-primary'
                        : 'text-muted'
                    }`}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
