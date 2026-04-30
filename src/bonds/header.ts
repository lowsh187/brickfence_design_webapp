import type { BondPattern, BondParams, BondResult, BrickData } from './types'

const BRICK_H = 76
const HEADER_W = 110 // Header width (when laid horizontally)
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
  // Header bond odd row: all headers (110mm wide), starts with adjustment piece
  // Pattern: adj(75) H H H ... H
  const elems: RowElem[] = []
  let x = 0

  // Start with adjustment piece (75mm)
  const adjWidth = 75
  elems.push({ x: Math.round(x), w: adjWidth, type: 'adj' })
  x += adjWidth + MORTAR_T

  // Fill rest with headers
  while (x + HEADER_W < wallL) {
    elems.push({ x: Math.round(x), w: HEADER_W, type: 'full' })
    x += HEADER_W + MORTAR_T
  }

  // Check if we need final adjustment piece
  const remaining = wallL - x + MORTAR_T
  if (remaining > 0 && remaining >= HEADER_W) {
    elems.push({ x: Math.round(x), w: HEADER_W, type: 'full' })
    x += HEADER_W
  } else if (remaining > 0 && remaining > HEADER_W - 5) {
    // Small gap - use adjustment piece
    const adjWidth = remaining - MORTAR_T
    elems.push({ x: Math.round(x), w: Math.round(adjWidth), type: 'adj' })
    x += adjWidth
  }

  return { elems, renderedL: x }
}

function evenRow(wallL: number): RowResult {
  // Header bond even row: all headers (110mm wide), starts with adjustment piece
  // Pattern: adj(55) H H H ... H
  const elems: RowElem[] = []
  let x = 0

  // Start with adjustment piece (55mm)
  const adjWidth = 55
  elems.push({ x: Math.round(x), w: adjWidth, type: 'adj' })
  x += adjWidth + MORTAR_T

  // Fill rest with headers
  while (x + HEADER_W < wallL) {
    elems.push({ x: Math.round(x), w: HEADER_W, type: 'full' })
    x += HEADER_W + MORTAR_T
  }

  // Check if we need final adjustment piece
  const remaining = wallL - x + MORTAR_T
  if (remaining > 0 && remaining >= HEADER_W) {
    elems.push({ x: Math.round(x), w: HEADER_W, type: 'full' })
    x += HEADER_W
  } else if (remaining > 0 && remaining > HEADER_W - 5) {
    // Small gap - use adjustment piece
    const adjWidth = remaining - MORTAR_T
    elems.push({ x: Math.round(x), w: Math.round(adjWidth), type: 'adj' })
    x += adjWidth
  }

  return { elems, renderedL: x }
}

function generate({ wallL, wallH }: BondParams): BondResult {
  // Header bond has all headers (110mm wide), so row height is just brick height + mortar
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

const HEADER_ICON = `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <rect width="80" height="40" fill="#c9b89a"/>
  <rect x="1"  y="1"  width="18" height="18" rx="1" fill="#b85530" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="21" y="1"  width="18" height="18" rx="1" fill="#a34525" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="41" y="1"  width="18" height="18" rx="1" fill="#c05838" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="61" y="1"  width="18" height="18" rx="1" fill="#9e3f20" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="1"  y="21" width="18" height="18" rx="1" fill="#ba5c35" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="21" y="21" width="18" height="18" rx="1" fill="#aa4a2c" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="41" y="21" width="18" height="18" rx="1" fill="#c05838" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="61" y="21" width="18" height="18" rx="1" fill="#9e3f20" stroke="#6a2208" stroke-width="0.4"/>
</svg>`

export const headerBond: BondPattern = {
  id: 'header',
  nameKey: 'bond.header',
  descKey: 'bond.headerDesc',
  iconSvg: HEADER_ICON,
  generate,
}