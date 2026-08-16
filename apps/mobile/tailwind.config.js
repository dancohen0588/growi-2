/**
 * Tokens du design system Growi, repris de apps/web/tailwind.config.ts.
 *
 * Les valeurs sont dupliquées en dur plutôt qu'importées : le web s'appuie sur
 * des variables CSS (`hsl(var(--border))`) que React Native ne sait pas
 * résoudre. Toute évolution du design system doit donc être reportée ici.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        lime: { DEFAULT: '#B4DD7F', pressed: '#a2cf6b' },
        forest: { DEFAULT: '#1E5631', light: '#2d7a47' },
        sand: { DEFAULT: '#F9F7E8', dark: '#ede9cc' },
        sun: { DEFAULT: '#F6C445', pressed: '#e4b030' },
        destructive: 'hsl(0 84% 60%)',
        'muted-foreground': 'hsl(139 20% 40%)',
        border: 'hsl(139 20% 80%)',
        input: 'hsl(139 20% 80%)',
        card: 'hsl(52 50% 97%)',
      },
      fontFamily: {
        // Titres en Poppins, corps en Raleway — chargées dans app/_layout.tsx.
        poppins: ['Poppins_600SemiBold'],
        'poppins-bold': ['Poppins_700Bold'],
        raleway: ['Raleway_400Regular'],
        'raleway-medium': ['Raleway_500Medium'],
        'raleway-semibold': ['Raleway_600SemiBold'],
      },
      fontSize: {
        // Échelle imposée par le design system ; 12 est le minimum absolu.
        caption: ['12px', '16px'],
        secondary: ['14px', '20px'],
        body: ['16px', '24px'],
        section: ['18px', '26px'],
        screen: ['24px', '32px'],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}
