# Changelog

Tracks what changed in each release, so the App Store / Play Store "What's
New" text can be written from something concrete instead of memory. Entries
move from **Unreleased** into a dated, versioned section once that build
actually ships.

## Unreleased (pending next build)

- Changed: the app is now called **HaulGenius** (home screen name, permission prompts, notifications) the launch screen shows the new H-arrow logo, and the sign-in screen shows the full HaulGenius logo (light and dark theme variants).
- Added: initial project scaffold (expo-kickstart, 2026-11-14).
- Changed: state management migrated from Zustand to Redux Toolkit + RTK Query (shared `@dispatcher/api-client`).
- Added: sign-in screen, secure session (refresh token in Keychain/Keystore, automatic token refresh) and sign-out.
- Changed: colors and fonts now come from the shared brand tokens (`packages/design-tokens`), so a rebrand is a single-file change.
- Changed: drivers only see the trips assigned to them (team roles, Phase 4).
- Added: Trips tab and trip screen — Pickup → En route → Delivery stepper, map, ETA and remaining km (location shared while the screen is open), Navigate, Call broker, documents (Rate Confirmation, POD/BOL/receipt photos) and expenses.
- Added: trip close-out — "Delivery completed!" with real profit and margin, broker rating, and "Find next load". Booked negotiations link to their trip; Home shows active trips and the next trip.
- Changed: requires a new dev build (react-native-maps, expo-image-picker; localized camera/photo permission texts).
- Added: AI negotiation — "Negotiate with AI" on a load, the "Negotiate & book" screen (AI offer vs posted rate, profit, margin, checklist, activity timeline), approve / adjust / book / cancel.
- Added: pending approvals on Home and push notifications when the AI needs you (asked when you start your first negotiation; tapping opens it).
- Added: load matching — Recommended / Near me / All tabs, "★ 98% Match" badges with reasons, empty km to pickup, and infinite scroll.
- Added: load detail screen with profit breakdown (loaded + empty km costs) and why-this-match reasons.
- Added: "Use my location" for nearby loads (foreground only, on request); localized iOS permission text.
- Changed: Home shows real opportunities (≥70% match) and the best one.
- Added: multi-language support — English, Français, Español and ਪੰਜਾਬੀ (Punjabi), shared with the web admin; first launch follows the device language and the choice syncs to the user profile.
- Added: Home (AI Dispatcher status + stats), Loads list (with DEMO badge and estimated profit) and Account tabs.
