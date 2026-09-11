const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const { withNativeWind } = require('nativewind/metro')

// Depuis le SDK 52, Expo configure seul Metro pour les monorepos : ni
// watchFolders, ni nodeModulesPaths, ni disableHierarchicalLookup à déclarer.
// Les ajouter à la main entrerait en conflit avec cette détection.
//
// `getSentryExpoConfig` est le `getDefaultConfig` d'Expo, plus ce qu'il faut
// pour que les source maps portent l'identifiant de debug que Sentry attend.
// Sans lui, les builds partent mais les piles de production restent
// illisibles : des adresses dans un bundle minifié, sans nom de fichier.
const config = getSentryExpoConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
