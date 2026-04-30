import type { BondPattern, BondParams, BondResult, BrickData } from './types'

const BRICK_L = 230
const BRICK_H = 76
const HALF_L = 110
const MORTAR_T = 10

interface RowElem {
  x: number
  w: number
  type: 'full' | 'half' | 'adj'
}

interface RowResult {
  elems: RowElem[]
  renderedL: number
}

function oddRow(wallL: number): RowResult {
  // English bond odd row: stretcher course with full-length bricks
  // Similar to stretcher.ts odd row pattern
  const unit = BRICK_L + MORTAR_T
  const n = Math.max(1, Math.floor((wallL + MORTAR_T) / unit))
  const natural = n * BRICK_L + (n - 1) * MORTAR_T
  let delta = wallL - natural

  if (delta > 0 && delta < 2 * MORTAR_T) {
    delta = delta <= MORTAR_T ? 0 : 2 * MORTAR_T
  }

  const ph = delta >= 2 * MORTAR_T ? delta / 2 - MORTAR_T : 0
  const expanded = delta >= 2 * MORTAR_T

  const elems: RowElem[] = []
  let x = 0
  for (let i = 0; i < n; i++) {
    elems.push({ x: Math.round(x), w: BRICK_L, type: 'full' })
    x += BRICK_L
    if (i < n - 1) {
      const endJoint = i === 0 || i === n - 2
      if (endJoint && expanded) {
        x += MORTAR_T
        if (ph > 0) {
          elems.push({ x: Math.round(x), w: Math.round(ph), type: 'adj' })
          x += ph
        }
        x += MORTAR_T
      } else {
        x += MORTAR_T
      }
    }
  }
  const last = elems[elems.length - 1]
  return { elems, renderedL: last.x + last.w }
}

function evenRow(wallL: number): RowResult {
  // English bond even row: header course with half-length bricks (110mm wide)
  const unit = HALF_L + MORTAR_T
  const n = Math.max(1, Math.floor((wallL + MORTAR_T) / unit))
  const natural = n * HALF_L + (n - 1) * MORTAR_T
  let delta = wallL - natural

  if (delta > 0 && delta < 2 * MORTAR_T) {
    delta = delta <= MORTAR_T ? 0 : 2 * MORTAR_T
  }

  const ph = delta >= 2 * MORTAR_T ? delta / 2 - MORTAR_T : 0
  const expanded = delta >= 2 * MORTAR_T

  const elems: RowElem[] = []
  let x = 0
  for (let i = 0; i < n; i++) {
    elems.push({ x: Math.round(x), w: HALF_L, type: 'full' })
    x += HALF_L
    if (i < n - 1) {
      const endJoint = i === 0 || i === n - 2
      if (endJoint && expanded) {
        x += MORTAR_T
        if (ph > 0) {
          elems.push({ x: Math.round(x), w: Math.round(ph), type: 'adj' })
          x += ph
        }
        x += MORTAR_T
      } else {
        x += MORTAR_T
      }
    }
  }
  const last = elems[elems.length - 1]
  return { elems, renderedL: last.x + last.w }
}

function generate({ wallL, wallH }: BondParams): BondResult {
  const courseH = BRICK_H + MORTAR_T
  const nRows = Math.ceil((wallH + MORTAR_T) / courseH)
  const wallPixH = nRows * courseH - MORTAR_T

  const bricks: BrickData[] = []
  let brickCount = 0

  for (let r = 0; r < nRows; r++) {
    const isOdd = r % 2 === 0
    const rowResult = isOdd ? oddRow(wallL) : evenRow(wallL)
    const y = wallPixH - ((r + 1) * courseH - MORTAR_T)

    for (const b of rowResult.elems) {
      bricks.push({ x: b.x, y, w: b.w, h: BRICK_H, row: r, type: b.type })
      if (b.type !== 'adj') brickCount++
    }
  }

  return {
    bricks,
    wallW: wallL,
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