# LM Scan — demo app

Android, physical device only. Built for the one-day demo described in
`docs/DEMO_PLAN.md`. Phases `D-0` … `D-5`; current phase is tracked in
`docs/PROGRESS.md` under **Now**.

## Running it

Connect the OnePlus Nord 4 by USB with developer options and USB debugging on, then:

```bash
cd mobile && npx expo run:android --device
```

There is **no emulator path and no Expo Go path**. ML Kit text recognition is a native
module, so Expo Go cannot load it, and an emulator's synthetic camera makes the core
loop untestable (project hard constraint).

Rebuild the native app only when a native dependency or `app.json` changes. Ordinary
JavaScript edits reload over Metro:

```bash
cd mobile && npx expo start --dev-client
```

## Layout

```
src/rulepack/   demo rule pack + validating loader   ← read the README in here first
src/scan/       normalisation, extraction cascade, fixtures
src/verdict/    the deterministic evaluator
plugins/        Expo config plugins applied at prebuild
```

## Things that will bite you

- **`mobile/` is not an npm workspace.** It has its own `package.json` and
  `node_modules`. Install from inside this directory, not the repo root.
- **`plugins/withLegacyGradleExt.js` is load-bearing.** Expo SDK 57 stopped publishing
  Android SDK versions on `rootProject.ext`; without the plugin,
  `@react-native-ml-kit/text-recognition` silently compiles against `compileSdk 28` and
  the build fails with an unrelated-looking dependency error. `android/` is generated
  and gitignored, so this cannot be a hand edit.
- **`android/local.properties` needs forward slashes.** `sdk.dir=C:/Users/...`. Java's
  properties parser eats single backslashes and Gradle then reports
  `IOException: The filename, directory name, or volume label syntax is incorrect`,
  which names neither the file nor the setting.
- **Nothing here is the real implementation.** The evaluator, the rule pack and the
  extraction heuristics are demo scaffolding, replaced by `T-1.3`, `T-1.7` and
  `T-2.1`–`T-2.3`. See `src/rulepack/README.md`.

## Checks

```bash
cd mobile && npx tsc --noEmit          # types
npm test                               # from the repo root — covers src/scan and src/verdict
```

`mobile/` is excluded from the root ESLint config because its tsconfig sits outside the
root project graph and type-aware linting cannot resolve it. `tsc --noEmit` here is what
covers it.
