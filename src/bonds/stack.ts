import type { BondPattern, BondParams, BondResult, BrickData } from './types'
import { DEFAULT_BRICK_DIMENSIONS, type BrickDimensions } from './brickDimensions'

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

function calculateStackRow(wallL: number, dimensions: BrickDimensions): RowResult {
  // Stack bond: distribute bricks evenly across the wall width
  // Use full bricks where possible, with adjustment pieces to fill gaps

  const elems: RowElem[] = []
  let x = 0

  // Calculate how many full bricks plus mortar joints fit
  const { length: brickL, mortar } = dimensions
  const unit = brickL + mortar
  const nUnits = Math.floor((wallL + mortar) / unit)

  // Place full bricks with mortar joints
  for (let i = 0; i < nUnits; i++) {
    elems.push({ x: Math.round(x), w: brickL, type: 'full' })
    x += brickL + mortar
  }

  // Calculate remaining space for adjustment piece
  const remaining = wallL - x + mortar

  let snapped = false
  let adjPieceLength = 0

  if (remaining > 0) {
    // Use dead-zone snapping like stretcher bond
    if (remaining < 2 * mortar) {
      snapped = true
      const snappedRemaining = remaining <= mortar ? 0 : 2 * mortar
      if (snappedRemaining > 0) {
        adjPieceLength = snappedRemaining - mortar
        elems.push({ x: Math.round(x), w: Math.round(adjPieceLength), type: 'adj' })
        x += adjPieceLength
      }
    } else {
      adjPieceLength = remaining - mortar
      elems.push({ x: Math.round(x), w: Math.round(adjPieceLength), type: 'adj' })
      x += adjPieceLength
    }
  }

  return {
    elems,
    snapped,
    adjPieceLength,
    renderedL: elems.length > 0 ? elems[elems.length - 1].x + elems[elems.length - 1].w : 0,
  }
}

function generate({ wallL, wallH, brickDimensions }: BondParams): BondResult {
  const dimensions = brickDimensions ?? DEFAULT_BRICK_DIMENSIONS
  const courseH = dimensions.height + dimensions.mortar
  const nRows = Math.ceil((wallH + dimensions.mortar) / courseH)
  const wallPixH = nRows * courseH - dimensions.mortar

  // Calculate row layout once - all rows are identical in stack bond
  const rowResult = calculateStackRow(wallL, dimensions)

  const bricks: BrickData[] = []
  let brickCount = 0

  for (let r = 0; r < nRows; r++) {
    const y = wallPixH - ((r + 1) * courseH - dimensions.mortar)
    for (const b of rowResult.elems) {
      bricks.push({ x: b.x, y, w: b.w, h: dimensions.height, row: r, type: b.type })
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
