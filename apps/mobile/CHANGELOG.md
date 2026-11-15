# Changelog

Tracks what changed in each release, so the App Store / Play Store "What's
New" text can be written from something concrete instead of memory. Entries
move from **Unreleased** into a dated, versioned section once that build
actually ships.

## Unreleased (pending next build)

- Added: initial project scaffold (expo-kickstart, 2026-11-14).
- Changed: state management migrated from Zustand to Redux Toolkit + RTK Query (shared `@dispatcher/api-client`).
- Added: sign-in screen, secure session (refresh token in Keychain/Keystore, automatic token refresh) and sign-out.
- Changed: colors and fonts now come from the shared brand tokens (`packages/design-tokens`), so a rebrand is a single-file change.
- Added: load matching — Recommended / Near me / All tabs, "★ 98% Match" badges with reasons, empty km to pickup, and infinite scroll.
- Added: load detail screen with profit breakdown (loaded + empty km costs) and why-this-match reasons.
- Added: "Use my location" for nearby loads (foreground only, on request); localized iOS permission text.
- Changed: Home shows real opportunities (≥70% match) and the best one.
- Added: multi-language support — English, Français, Español and ਪੰਜਾਬੀ (Punjabi), shared with the web admin; first launch follows the device language and the choice syncs to the user profile.
- Added: Home (AI Dispatcher status + stats), Loads list (with DEMO badge and estimated profit) and Account tabs.
