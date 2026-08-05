const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix EMFILE: too many open files on macOS
// Forces Metro to use Watchman instead of Node's native FSWatcher
// Watchman is now installed at /usr/local/bin/watchman via Homebrew
config.resolver.sourceExts = [...config.resolver.sourceExts];

// Exclude node_modules sub-directories from direct watching
// Metro resolves them via the resolver, not direct FS watching
config.watchFolders = [__dirname];

module.exports = config;
