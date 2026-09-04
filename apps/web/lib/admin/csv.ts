/**
 * Fabrication du CSV d'export.
 *
 * Deux précautions, sans lesquelles le fichier s'ouvre mal ou devient dangereux :
 *
 * 1. **BOM UTF-8.** Sans lui, Excel sous Windows lit le fichier en Latin-1 et
 *    tous les accents sont cassés — ce qui, sur des noms de personnes, n'est pas
 *    un détail cosmétique.
 * 2. **Neutralisation des formules.** Une cellule commençant par `=`, `+`, `-`
 *    ou `@` est exécutée à l'ouverture par Excel et LibreOffice. Un utilisateur
 *    qui se prénomme `=cmd|...` ferait exécuter quelque chose sur le poste de
 *    celui qui ouvre l'export. On préfixe donc d'une apostrophe.
 */

const RISKY_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''

  let text = String(value)
  if (RISKY_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    text = `'${text}`
  }

  // Guillemets doublés, et champ cité dès qu'il contient un séparateur, un
  // guillemet ou un saut de ligne.
  if (/[";\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

/**
 * Assemble un CSV.
 *
 * Séparateur `;` et non `,` : c'est ce qu'attend Excel dans une locale
 * française, où la virgule est le séparateur décimal.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(';')]
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(';'))
  }
  return `﻿${lines.join('\r\n')}\r\n`
}

/** Nom de fichier horodaté, pour que deux exports ne se recouvrent pas. */
export function csvFilename(prefix: string, at: Date = new Date()): string {
  const stamp = at.toISOString().slice(0, 16).replace(/[:T]/g, '-')
  return `${prefix}-${stamp}.csv`
}
