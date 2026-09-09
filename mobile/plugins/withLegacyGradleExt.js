/**
 * Expo config plugin — republish the Android SDK versions on `rootProject.ext`.
 *
 * Why this exists
 * ---------------
 * Third-party React Native Android libraries written before Expo SDK 53 read their
 * SDK levels with the `safeExtGet(prop, fallback)` idiom:
 *
 *     compileSdkVersion safeExtGet('compileSdkVersion', 28)
 *
 * Expo SDK 57's generated `android/build.gradle` no longer defines those `ext`
 * properties — `expo-module-gradle-plugin` resolves them internally instead. A legacy
 * library therefore silently takes its fallback and compiles against **compileSdk 28**,
 * which cannot resolve modern androidx / ML Kit artifacts. The failure surfaces as an
 * unrelated-looking dependency resolution error deep in the Gradle log.
 *
 * `@react-native-ml-kit/text-recognition` — the OCR engine this demo is built on — is
 * exactly such a library.
 *
 * `android/` is generated and gitignored, so this cannot be a hand edit: it has to be a
 * plugin, or the next `expo prebuild` silently reintroduces the bug.
 *
 * The values mirror what Expo SDK 57 / React Native 0.86 use by default. `buildToolsVersion`
 * is pinned to a revision already present in the local SDK so no download is needed.
 */

const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// >>> withLegacyGradleExt';

const EXT_BLOCK = `${MARKER}
// Legacy third-party Android libraries read these via safeExtGet(). Expo SDK 57 no
// longer defines them, so without this block they fall back to compileSdk 28.
ext {
  compileSdkVersion = 36
  targetSdkVersion = 36
  minSdkVersion = 24
  buildToolsVersion = '36.1.0'
}
// <<< withLegacyGradleExt
`;

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withLegacyGradleExt = (config) =>
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        'withLegacyGradleExt: expected a Groovy android/build.gradle, got ' +
          cfg.modResults.language,
      );
    }
    if (cfg.modResults.contents.includes(MARKER)) {
      return cfg;
    }
    const anchor = 'allprojects {';
    if (!cfg.modResults.contents.includes(anchor)) {
      throw new Error(
        "withLegacyGradleExt: could not find the 'allprojects {' anchor in android/build.gradle",
      );
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(anchor, `${EXT_BLOCK}\n${anchor}`);
    return cfg;
  });

module.exports = withLegacyGradleExt;
