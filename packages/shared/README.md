# @growi/shared

Types TypeScript, schémas Zod et constantes métier partagés entre `apps/web` et `apps/mobile`.

Package « source-first » : pas d'étape de build, les consommateurs importent directement
le TypeScript (`transpilePackages` côté Next.js, transpilation Babel/Metro côté Expo).

```ts
import { /* ... */ } from '@growi/shared'
```
