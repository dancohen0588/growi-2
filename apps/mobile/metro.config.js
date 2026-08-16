const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

// Depuis le SDK 52, Expo configure seul Metro pour les monorepos : ni
// watchFolders, ni nodeModulesPaths, ni disableHierarchicalLookup à déclarer.
// Les ajouter à la main entrerait en conflit avec cette détection.
const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
