import type { BondPattern, BondParams, BondResult, BrickData } from './types'
import { DEFAULT_BRICK_DIMENSIONS, type BrickDimensions } from './brickDimensions'

interface RowElem {
  x: number
  w: number
  type: 'full' | 'half' | 'adj'
}

interface RowResult {
  elems: RowElem[]
  renderedL: number
}

function oddRow(wallL: number, dimensions: BrickDimensions): RowResult {
  // English bond odd row: stretcher course with full-length bricks
  // Similar to stretcher.ts odd row pattern
  const { length: brickL, mortar } = dimensions
  const unit = brickL + mortar
  const n = Math.max(1, Math.floor((wallL + mortar) / unit))
  const natural = n * brickL + (n - 1) * mortar
  let delta = wallL - natural

  if (delta > 0 && delta < 2 * mortar) {
    delta = delta <= mortar ? 0 : 2 * mortar
  }

  const ph = delta >= 2 * mortar ? delta / 2 - mortar : 0
  const expanded = delta >= 2 * mortar

  const elems: RowElem[] = []
  let x = 0
  for (let i = 0; i < n; i++) {
    elems.push({ x: Math.round(x), w: brickL, type: 'full' })
    x += brickL
    if (i < n - 1) {
      const endJoint = i === 0 || i === n - 2
      if (endJoint && expanded) {
        x += mortar
        if (ph > 0) {
          elems.push({ x: Math.round(x), w: Math.round(ph), type: 'adj' })
          x += ph
        }
        x += mortar
      } else {
        x += mortar
      }
    }
  }
  const last = elems[elems.length - 1]
  return { elems, renderedL: last.x + last.w }
}

function shiftedHeaderRow(wallL: number, dimensions: BrickDimensions, shifted: boolean): RowResult {
  // English bond even row: header course with half-length bricks (110mm wide)
  const { width: brickW, mortar } = dimensions
  const offset = shifted ? Math.round((brickW + mortar) / 2) : 0
  const elems: RowElem[] = []
  let x = 0

  if (offset > 0) {
    elems.push({ x: 0, w: Math.min(offset, wallL), type: 'adj' })
    x = offset + mortar
  }

  while (x < wallL) {
    const remaining = wallL - x
    if (remaining >= brickW) {
      elems.push({ x: Math.round(x), w: brickW, type: 'full' })
    } else {
      elems.push({ x: Math.round(x), w: Math.round(remaining), type: 'adj' })
      break
    }
    x += brickW
    if (wallL - x <= mortar) break
    x += mortar
  }

  const last = elems[elems.length - 1]
  return { elems, renderedL: last ? last.x + last.w : 0 }
}

function generate({ wallL, wallH, brickDimensions }: BondParams): BondResult {
  const dimensions = brickDimensions ?? DEFAULT_BRICK_DIMENSIONS
  const courseH = dimensions.height + dimensions.mortar
  const nRows = Math.ceil((wallH + dimensions.mortar) / courseH)
  const wallPixH = nRows * courseH - dimensions.mortar

  const bricks: BrickData[] = []
  let brickCount = 0
  let wallPixW = 0

  for (let r = 0; r < nRows; r++) {
    const isOdd = r % 2 === 0
    const rowResult = isOdd
      ? oddRow(wallL, dimensions)
      : shiftedHeaderRow(wallL, dimensions, Math.floor(r / 2) % 2 === 1)
    wallPixW = Math.max(wallPixW, rowResult.renderedL)
    const y = wallPixH - ((r + 1) * courseH - dimensions.mortar)

    for (const b of rowResult.elems) {
      bricks.push({ x: b.x, y, w: b.w, h: dimensions.height, row: r, type: b.type })
      if (b.type !== 'adj') brickCount++
    }
  }

  return {
    bricks,
    wallW: wallPixW,
    wallH: wallPixH,
    nRows,
    brickCount,
    adjPieceLength: 0,
    snapped: false,
  }
}

const ENGLISH_ICON = `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <rect width="80" height="40" fill="#c9b89a"/>
  <rect x="1"  y="1"  width="38" height="18" rx="1" fill="#b85530" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="41" y="1"  width="38" height="18" rx="1" fill="#a34525" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="1"  y="21" width="18" height="18" rx="1" fill="#c05838" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="21" y="21" width="18" height="18" rx="1" fill="#9e3f20" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="41" y="21" width="18" height="18" rx="1" fill="#ba5c35" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="61" y="21" width="18" height="18" rx="1" fill="#aa4a2c" stroke="#6a2208" stroke-width="0.4"/>
</svg>`

export const englishBond: BondPattern = {
  id: 'english',
  nameKey: 'bond.english',
  descKey: 'bond.englishDesc',
  iconSvg: ENGLISH_ICON,
  generate,
}
