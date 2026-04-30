import type { BondPattern, BondParams, BondResult, BrickData } from './types'

const BRICK_L = 230
const BRICK_H = 76
const MORTAR_T = 10

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

function calculateStackRow(wallL: number): RowResult {
  // Stack bond: distribute bricks evenly across the wall width
  // Use full bricks where possible, with adjustment pieces to fill gaps

  const elems: RowElem[] = []
  let x = 0
  let brickCount = 0

  // Calculate how many full bricks plus mortar joints fit
  const unit = BRICK_L + MORTAR_T
  const nUnits = Math.floor((wallL + MORTAR_T) / unit)

  // Place full bricks with mortar joints
  for (let i = 0; i < nUnits; i++) {
    elems.push({ x: Math.round(x), w: BRICK_L, type: 'full' })
    brickCount++
    x += BRICK_L + MORTAR_T
  }

  // Calculate remaining space for adjustment piece
  const remaining = wallL - x + MORTAR_T // + MORTAR_T because we didn't add the last mortar

  let snapped = false
  let adjPieceLength = 0

  if (remaining > 0) {
    // Use dead-zone snapping like stretcher bond
    if (remaining < 2 * MORTAR_T) {
      snapped = true
      // Snap to either 0 or 2*MORTAR_T
      const snappedRemaining = remaining <= MORTAR_T ? 0 : 2 * MORTAR_T
      if (snappedRemaining > 0) {
        adjPieceLength = snappedRemaining - MORTAR_T
        elems.push({ x: Math.round(x), w: Math.round(adjPieceLength), type: 'adj' })
        x += adjPieceLength
      }
    } else {
      // Large enough gap - add adjustment piece
      adjPieceLength = remaining - MORTAR_T
      elems.push({ x: Math.round(x), w: Math.round(adjPieceLength), type: 'adj' })
      x += adjPieceLength
    }
  }

  return {
    elems,
    snapped,
    adjPieceLength,
    renderedL: x
  }
}

function generate({ wallL, wallH }: BondParams): BondResult {
  const courseH = BRICK_H + MORTAR_T
  const nRows = Math.ceil((wallH + MORTAR_T) / courseH)
  const wallPixH = nRows * courseH - MORTAR_T

  // Calculate row layout once - all rows are identical in stack bond
  const rowResult = calculateStackRow(wallL)

  const bricks: BrickData[] = []
  let brickCount = 0

  for (let r = 0; r < nRows; r++) {
    const y = wallPixH - ((r + 1) * courseH - MORTAR_T)
    for (const b of rowResult.elems) {
      bricks.push({ x: b.x, y, w: b.w, h: BRICK_H, row: r, type: b.type })
      if (b.type !== 'adj') brickCount++
    }
  }

  return {
    bricks,
    wallW: rowResult.renderedL,
    wallH: wallPixH,
    nRows,
    brickCount,
    adjPieceLength: rowResult.adjPieceLength,
    snapped: rowResult.snapped,
  }
}

const STACK_ICON = `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
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

export const stackBond: BondPattern = {
  id: 'stack',
  nameKey: 'bond.stack',
  descKey: 'bond.stackDesc',
  iconSvg: STACK_ICON,
  generate,
}