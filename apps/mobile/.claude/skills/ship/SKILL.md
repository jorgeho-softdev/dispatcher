---
name: ship
description: Build and submit the app with EAS (TestFlight / Play internal testing). Use when the user asks to ship, deploy, "subir a TestFlight", or release a build.
---

# Ship a build

1. `git status --porcelain` — commit pending work first (descriptive
   message, not "deploy").
2. `npm run typecheck` must pass.
3. Launch in the background (`run_in_background: true`) — it takes 10+ min:
   - iOS: `npx eas-cli build --platform ios --profile production --auto-submit --non-interactive`
   - Android: `npx eas-cli build --platform android --profile production --auto-submit --non-interactive`
4. `eas.json` has `production.autoIncrement: true`: build numbers bump
   automatically — never edit `ios.buildNumber` / `android.versionCode` by hand.
5. On success, report the build URL and submission URL from the output.

## Known failures

- **Transient upload errors (`EPIPE`, stalled upload)**: retry the same command.
- **Apple 90062 / 90186 ("must contain a higher version", "train is closed")**:
  `expo.version` in `app.json` was already approved. Bump it (patch unless
  told otherwise), commit with the error code in the message, rebuild.
- **`npx eas` resolves to a broken binary**: use `npx eas-cli` instead.
