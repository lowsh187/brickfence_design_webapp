import type { BondPattern } from './types'
import { stretcherBond } from './stretcher'
import { stackBond } from './stack'
import { headerBond } from './header'
import { englishBond } from './english'
import { flemishGardenBond } from './flemishGarden'

const patterns: Map<string, BondPattern> = new Map()

export function registerBond(p: BondPattern): void {
  patterns.set(p.id, p)
}

export function getBond(id: string): BondPattern | undefined {
  return patterns.get(id)
}

export function allBonds(): BondPattern[] {
  return [...patterns.values()]
}

registerBond(stretcherBond)
registerBond(stackBond)
registerBond(headerBond)
registerBond(englishBond)
registerBond(flemishGardenBond)
