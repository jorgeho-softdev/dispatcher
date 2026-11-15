import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '@/store/hooks';
import { selectThemeId } from '@/store/settings-slice';
import { themes, defaultThemeId, Theme } from './themes';

// The reactive binding between the theme registry (lib/themes.ts, pure data)
// and the persisted user choice (settings.themeId). Call this — or
// useColors() — inside a component so colors update immediately when the
// user switches themes in Settings.
export function useTheme(): Theme {
  const themeId = useAppSelector(selectThemeId);
  return themes[themeId] ?? themes[defaultThemeId];
}

export function useColors() {
  return useTheme().colors;
}

// Kept as a hook (not inline in the Tabs layout) so any screen that has to
// temporarily override the tab bar via navigation.setOptions can restore
// this exact object afterwards instead of React Navigation's white default.
export function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  return {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    height: 60 + insets.bottom,
    paddingBottom: 8 + insets.bottom,
    paddingTop: 6,
  };
}
