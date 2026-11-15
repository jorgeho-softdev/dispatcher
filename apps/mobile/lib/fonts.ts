import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { typography } from '@dispatcher/design-tokens';

// The ONLY place the mobile app loads the brand font files (family name is
// documented in packages/design-tokens/src/tokens.ts → typography.family).
// Fonts are registered under generic aliases (Brand-Regular, Brand-Bold…),
// so to change the font: install another @expo-google-fonts/* package and
// swap the four imports below. Nothing else changes.
const { mobileAliases } = typography;

export const fontAssets = {
  [mobileAliases.regular]: Inter_400Regular,
  [mobileAliases.medium]: Inter_500Medium,
  [mobileAliases.semibold]: Inter_600SemiBold,
  [mobileAliases.bold]: Inter_700Bold,
};

export const fontFamily = mobileAliases;
