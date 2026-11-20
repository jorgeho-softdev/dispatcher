import '@/global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { vars } from 'nativewind';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { store } from '@/store';
import { useAppSelector } from '@/store/hooks';
import { selectAuthStatus } from '@/store/auth-slice';
import { selectHasCompletedOnboarding } from '@/store/settings-slice';
import { bootstrapSession } from '@/store/session';
import { useTheme } from '@/lib/theme';
import { fontAssets } from '@/lib/fonts';
import { IntlRoot } from '@/lib/IntlRoot';
import { AppAlertHost } from '@/components/ui/AppAlertHost';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { PushRegistration } from '@/features/negotiation/PushRegistration';

SplashScreen.preventAutoHideAsync();

// Restore the session from the keychain as early as possible.
store.dispatch(bootstrapSession());

export default function RootLayout() {
  return (
    <Provider store={store}>
      <IntlRoot>
        <RootNavigator />
      </IntlRoot>
    </Provider>
  );
}

function RootNavigator() {
  const [fontsLoaded] = useFonts(fontAssets);
  const theme = useTheme();
  const authStatus = useAppSelector(selectAuthStatus);
  const hasCompletedOnboarding = useAppSelector(selectHasCompletedOnboarding);
  const ready = fontsLoaded && authStatus !== 'booting';
  const signedIn = authStatus === 'signedIn';

  // Hold the native splash until fonts are loaded AND we know whether the
  // user is signed in, so the first frame is already the right screen.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    // `vars(theme.cssVars)` makes the active theme's colors live for every
    // `bg-*`/`text-*` className below — switching themes is just a re-render.
    <GestureHandlerRootView style={vars(theme.cssVars)} className="flex-1 bg-background">
      <SafeAreaProvider>
        <StatusBar style={theme.statusBarStyle} />
        {hasCompletedOnboarding ? (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          >
            {/* Protected routes: Expo Router redirects automatically when
                the guard flips (sign-in / sign-out / expired session). */}
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="loads/[id]" />
              <Stack.Screen name="negotiations/[id]" />
              <Stack.Screen name="trips/[id]" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
            </Stack.Protected>
          </Stack>
        ) : (
          <OnboardingScreen />
        )}
        {signedIn && <PushRegistration />}
        <AppAlertHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
