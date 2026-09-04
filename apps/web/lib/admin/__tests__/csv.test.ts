import { describe, expect, it } from 'vitest'

import { csvFilename, toCsv } from '../csv'

describe('toCsv', () => {
  it('ouvre par un BOM UTF-8', () => {
    // Sans lui, Excel sous Windows lit le fichier en Latin-1 : « Benoît »
    // devient « BenoÃ®t » sur une colonne de noms de personnes.
    expect(toCsv(['Nom'], [['Benoît']]).startsWith('﻿')).toBe(true)
  })

  it('sépare par des points-virgules', () => {
    expect(toCsv(['A', 'B'], [[1, 2]])).toContain('A;B')
  })

  it('neutralise les cellules interprétées comme des formules', () => {
    // Cas réel d'injection : Excel exécute la cellule à l'ouverture.
    const csv = toCsv(['Nom'], [['=1+1'], ['+33600000000'], ['-5'], ['@SUM(A1)']])

    expect(csv).toContain("'=1+1")
    expect(csv).toContain("'+33600000000")
    expect(csv).toContain("'-5")
    expect(csv).toContain("'@SUM(A1)")
  })

  it('cite et échappe ce qui contient un séparateur, un guillemet ou un saut de ligne', () => {
    expect(toCsv(['A'], [['Lyon; Rhône']])).toContain('"Lyon; Rhône"')
    expect(toCsv(['A'], [['dit "Jules"']])).toContain('"dit ""Jules"""')
    expect(toCsv(['A'], [['ligne1\nligne2']])).toContain('"ligne1\nligne2"')
  })

  it('rend les valeurs absentes par une cellule vide', () => {
    expect(toCsv(['A', 'B', 'C'], [[null, undefined, '']])).toContain(';;')
  })
})

describe('csvFilename', () => {
  it('horodate le nom pour que deux exports ne se recouvrent pas', () => {
    const name = csvFilename('growi-utilisateurs', new Date('2026-09-04T14:30:00.000Z'))
    expect(name).toBe('growi-utilisateurs-2026-09-04-14-30.csv')
  })
})
