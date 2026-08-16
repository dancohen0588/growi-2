/// <reference types="nativewind/types" />

// La feuille Tailwind est importée pour son effet de bord dans app/_layout.tsx :
// c'est Metro qui la traite, TypeScript a seulement besoin de la connaître.
declare module '*.css' {}
