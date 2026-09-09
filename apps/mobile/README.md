# Growi mobile

App Expo (SDK 54, React Native 0.81, Expo Router, NativeWind 4).

```bash
pnpm --filter mobile start       # Metro + QR code
pnpm --filter mobile typecheck
```

Variables d'environnement : copier `.env.example` vers `.env`. Pour tester sur
un téléphone, `EXPO_PUBLIC_API_URL` doit porter l'IP du Mac sur le réseau
local, jamais `localhost`.

## Observabilité

Sentry couvre les crashs, les erreurs et les traces de l'app (projet
`growi-mobile`, région UE). PostHog viendra en passe C. Spec :
`~/Growi/Documentation/spec/09-spec-observabilite.md`.

| Fichier | Rôle |
|---|---|
| `lib/observability/sentry.ts` | `initSentry()`, l'identité, l'intégration de navigation |
| `lib/observability/report.ts` | Ce qu'on remonte, et comment on le regroupe |
| `lib/query-client.ts` | Les deux caches React Query, point unique de remontée |
| `components/profil/VersionRow.tsx` | Le numéro de build, et la vérification cachée |

**En développement, rien ne part** : `initSentry()` ne fait rien si `__DEV__`
est vrai ou si `EXPO_PUBLIC_SENTRY_DSN` manque. Il faut donc un build EAS
(profil `preview` ou `production`) pour voir quoi que ce soit.

**Ce qui n'est volontairement pas remonté** : réseau coupé, 401, 403, 404,
429 et erreurs de validation. Ce sont des réponses, pas des pannes — l'app
sait déjà quoi en dire à l'utilisateur. Restent les 5xx et tout ce qui n'est
pas une `ApiError`, c'est-à-dire nos propres bugs.

**Aucune donnée personnelle** : `sendDefaultPii: false`, pas de capture
d'écran jointe (`attachScreenshot: false`), `Sentry.setUser` ne pose que
l'identifiant interne, et `scrubEvent` — le **même code que le web**, dans
`@growi/shared` — retire jeton, e-mail et photo.

### Vérifier la chaîne sur un build preview

1. `eas build -p ios --profile preview` et `-p android --profile preview`.
2. Dans l'app : onglet Accueil → Profil, tout en bas, **appui long de cinq
   secondes** sur le numéro de version. Un message part vers Sentry, puis une
   confirmation propose un crash volontaire.
3. Dans Sentry → `growi-mobile` : le message et le crash doivent apparaître
   avec `environment: preview` et la release `growi-mobile@1.0.0+<build>`.
4. La pile du crash doit être **symbolisée** (noms de fichiers et de
   fonctions, pas des adresses). Sinon, vérifier Settings → Source Maps du
   projet : le téléversement se fait pendant le build EAS, avec
   `SENTRY_AUTH_TOKEN`.

Ce geste caché et son écran disparaissent à la fin de la Friends & Family.

### Quatre pièges

- **`@sentry/cli` est déclaré en dépendance directe de cette app**, alors que
  rien dans notre code ne l'importe : c'est l'étape Xcode d'upload des source
  maps qui l'exécute, en le résolvant depuis `ios/` avec
  `require.resolve('@sentry/cli/package.json')`. Sous pnpm, un paquet non
  déclaré n'est pas dans `node_modules` de l'app, et cette résolution échoue.
  Le script de Sentry a bien un repli pour pnpm, mais il lit le `NODE_PATH` du
  shim et le tronque à `/bin` : notre chemin n'en contient pas, si bien qu'il
  passait le `NODE_PATH` entier à `node` comme s'il s'agissait d'un fichier.
  D'où l'échec du build iOS avec `node:internal/modules/cjs/loader`. **Ne pas
  retirer cette dépendance.**

- **`metro.config.js` doit utiliser `getSentryExpoConfig`**, pas
  `getDefaultConfig` : c'est lui qui pose l'identifiant de debug des source
  maps. Sans lui, le build passe et les piles restent illisibles.
- **L'organisation Sentry est en région UE** : `url: "https://de.sentry.io/"`
  dans le plugin (`app.json`). Avec `sentry.io`, le téléversement échoue.
  L'organisation et le projet, eux, viennent de `SENTRY_ORG` / `SENTRY_PROJECT`
  côté EAS — jamais de jeton dans `app.json`, qui part dans le binaire.
- **Le fil de discussion n'est pas tracé** : il passe par le `fetch`
  d'`expo/fetch` (voir `lib/api.ts`), que Sentry n'instrumente pas. Sa latence
  se lit côté serveur, dans le span `gemini.generate` du projet `growi-web`.
