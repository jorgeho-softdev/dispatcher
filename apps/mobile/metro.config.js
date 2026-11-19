const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const repoRoot = path.resolve(__dirname, '../..');

// Expo watches every npm workspace by default, so Metro also saw apps/web and
// apps/api. Next.js writes apps/web/.next on every page compile and Nest
// writes apps/api/dist on every rebuild, and Metro reloaded the app for those
// changes. The app only depends on itself, the shared packages and node_modules.
config.watchFolders = config.watchFolders.filter(
  (folder) => !folder.startsWith(path.join(repoRoot, 'apps')) || folder === __dirname,
);

// Build output of the other apps never belongs to the mobile bundle.
const escape = (p) => p.replace(/[/\\^$.*+?()[\]{}|]/g, '\\$&');
const otherAppsBuildOutput = ['apps/web', 'apps/api'].map(
  (app) => new RegExp(`^${escape(path.join(repoRoot, app))}([\\\\/].*)?$`),
);
const turboCache = /[\\/]\.turbo[\\/].*/;
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  ...otherAppsBuildOutput,
  turboCache,
];

module.exports = withNativeWind(config, { input: './global.css' });
