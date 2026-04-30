import type { BondPattern, BondParams, BondResult, BrickData } from './types'

const BRICK_L = 230
const BRICK_H = 76
const HALF_L = 110
const MORTAR_T = 10
const START_ADJ = 170

interface RowElem {
  x: number
  w: number
  type: 'full' | 'half' | 'adj'
}

interface RowResult {
  elems: RowElem[]
  snapped: boolean
  adjPieceLength: number
  renderedL: number
}

const ODD_ROW_WIDTHS = [
  BRICK_L, BRICK_L, BRICK_L, HALF_L,
  BRICK_L, BRICK_L, BRICK_L, HALF_L,
  BRICK_L, BRICK_L, BRICK_L, HALF_L,
  BRICK_L, BRICK_L, BRICK_L, HALF_L,
  BRICK_L, BRICK_L,
]

const EVEN_ROW_FIXED_WIDTHS_AFTER_SECOND_HALF = [
  BRICK_L, BRICK_L, BRICK_L, HALF_L,
  BRICK_L, BRICK_L, BRICK_L, HALF_L,
  BRICK_L, BRICK_L, BRICK_L, HALF_L,
  BRICK_L, BRICK_L, BRICK_L, HALF_L,
]

function oddRow(wallL: number): RowResult {
  const fixedWidth = ODD_ROW_WIDTHS.reduce((sum, w) => sum + w, 0)
  const baseNoAdjLength = fixedWidth + (ODD_ROW_WIDTHS.length - 1) * MORTAR_T
  const delta = wallL - baseNoAdjLength

  let snapped = false
  let adjPieceLength = 0

  if (delta >= 2 * MORTAR_T) {
    adjPieceLength = delta - MORTAR_T
  } else if (delta > 0 || delta < 0) {
    snapped = true
  }

  const elems: RowElem[] = []
  let x = 0

  for (let i = 0; i < ODD_ROW_WIDTHS.length; i++) {
    const w = ODD_ROW_WIDTHS[i]
    elems.push({ x: Math.round(x), w, type: w === HALF_L ? 'half' : 'full' })
    x += w
    x += MORTAR_T
  }

  if (adjPieceLength > 0) {
    elems.push({ x: Math.round(x), w: Math.round(adjPieceLength), type: 'adj' })
    x += adjPieceLength
  } else {
    x -= MORTAR_T
  }

  return {
    elems,
    snapped,
    adjPieceLength,
    renderedL: x,
  }
}

function evenRow(wallL: number): RowResult {
  const fixedWidth = EVEN_ROW_FIXED_WIDTHS_AFTER_SECOND_HALF.reduce((sum, w) => sum + w, 0)
  const baseNoEndAdjLength =
    HALF_L + MORTAR_T +
    START_ADJ + MORTAR_T +
    HALF_L + MORTAR_T +
    fixedWidth + (EVEN_ROW_FIXED_WIDTHS_AFTER_SECOND_HALF.length - 1) * MORTAR_T

  const delta = wallL - baseNoEndAdjLength

  let snapped = false
  let endAdjLength = 0

  if (delta >= 2 * MORTAR_T) {
    endAdjLength = delta - MORTAR_T
  } else if (delta > 0 || delta < 0) {
    snapped = true
  }

  const elems: RowElem[] = []
  let x = 0

  elems.push({ x: Math.round(x), w: HALF_L, type: 'half' })
  x += HALF_L + MORTAR_T

  elems.push({ x: Math.round(x), w: START_ADJ, type: 'adj' })
  x += START_ADJ + MORTAR_T

  elems.push({ x: Math.round(x), w: HALF_L, type: 'half' })
  x += HALF_L + MORTAR_T

  for (let i = 0; i < EVEN_ROW_FIXED_WIDTHS_AFTER_SECOND_HALF.length; i++) {
    const w = EVEN_ROW_FIXED_WIDTHS_AFTER_SECOND_HALF[i]
    elems.push({ x: Math.round(x), w, type: w === HALF_L ? 'half' : 'full' })
    x += w
    if (i < EVEN_ROW_FIXED_WIDTHS_AFTER_SECOND_HALF.length - 1 || endAdjLength > 0) {
      x += MORTAR_T
    }
  }

  if (endAdjLength > 0) {
    elems.push({ x: Math.round(x), w: Math.round(endAdjLength), type: 'adj' })
    x += endAdjLength
  }

  return {
    elems,
    snapped,
    adjPieceLength: endAdjLength,
    renderedL: x,
  }
}

function generate({ wallL, wallH }: BondParams): BondResult {
  const courseH = BRICK_H + MORTAR_T
  const nRows = Math.ceil((wallH + MORTAR_T) / courseH)
  const wallPixH = nRows * courseH - MORTAR_T

  const odd = oddRow(wallL)
  const even = evenRow(wallL)

  const bricks: BrickData[] = []
  let brickCount = 0

  for (let r = 0; r < nRows; r++) {
    const row = r % 2 === 0 ? odd : even
    const y = wallPixH - ((r + 1) * courseH - MORTAR_T)

    for (const b of row.elems) {
      bricks.push({ x: b.x, y, w: b.w, h: BRICK_H, row: r, type: b.type })
      if (b.type !== 'adj') brickCount++
    }
  }

  return {
    bricks,
    wallW: Math.min(odd.renderedL, even.renderedL),
    wallH: wallPixH,
    nRows,
    brickCount,
    adjPieceLength: Math.max(odd.adjPieceLength, even.adjPieceLength),
    snapped: odd.snapped || even.snapped,
  }
}

const FLEMISH_GARDEN_ICON = `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <rect width="80" height="40" fill="#c9b89a"/>
  <rect x="1" y="1" width="22" height="18" rx="1" fill="#b85530" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="24" y="1" width="22" height="18" rx="1" fill="#a34525" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="47" y="1" width="22" height="18" rx="1" fill="#c05838" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="1" y="21" width="18" height="18" rx="1" fill="#9e3f20" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="21" y="21" width="18" height="18" rx="1" fill="#ba5c35" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="41" y="21" width="18" height="18" rx="1" fill="#aa4a2c" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="61" y="21" width="18" height="18" rx="1" fill="#9e3f20" stroke="#6a2208" stroke-width="0.4"/>
</svg>`

export const flemishGardenBond: BondPattern = {
  id: 'flemishGarden',
  nameKey: 'bond.flemishGarden',
  descKey: 'bond.flemishGardenDesc',
  iconSvg: FLEMISH_GARDEN_ICON,
  generate,
}
