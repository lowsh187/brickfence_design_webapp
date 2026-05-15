import type { BondPattern, BondParams, BondResult, BrickData } from './types'
import {
  DEFAULT_BRICK_DIMENSIONS,
  MIN_CUT_BRICK_DIMENSION,
  type BrickDimensions,
} from './brickDimensions'
import { hasInvalidCutBrick } from './cutRules'

interface RowElem {
  x: number
  w: number
  type: 'full' | 'half' | 'adj'
}

interface RowResult {
  elems: RowElem[]
  renderedL: number
  snapped: boolean
  adjPieceLength: number
}

function headerRow(wallL: number, dimensions: BrickDimensions, shifted: boolean): RowResult {
  const elems: RowElem[] = []
  let x = 0
  const { width: headerW, mortar } = dimensions
  let snapped = false
  let adjPieceLength = 0

  if (shifted) {
    const startCut = headerW / 2
    elems.push({ x: 0, w: Math.round(startCut), type: 'adj' })
    adjPieceLength = Math.max(adjPieceLength, startCut)
    x = startCut + mortar
  }

  while (x + headerW <= wallL) {
    elems.push({ x: Math.round(x), w: headerW, type: 'full' })
    x += headerW + mortar
  }

  const nextX = x - mortar
  const endCut = wallL - nextX

  if (endCut >= MIN_CUT_BRICK_DIMENSION) {
    elems.push({ x: Math.round(nextX), w: Math.round(endCut), type: 'adj' })
    adjPieceLength = Math.max(adjPieceLength, endCut)
  } else if (endCut > 0) {
    snapped = true
  }

  const last = elems[elems.length - 1]
  return {
    elems,
    renderedL: last ? last.x + last.w : 0,
    snapped,
    adjPieceLength,
  }
}

function snapHeaderWallLength(wallL: number, dimensions: BrickDimensions): number {
  const unit = dimensions.width + dimensions.mortar
  const searchLimit = Math.max(unit * 12, MIN_CUT_BRICK_DIMENSION * 4)

  for (let offset = 0; offset <= searchLimit; offset++) {
    const candidate = wallL + offset
    const straightRow = headerRow(candidate, dimensions, false)
    const shiftedRow = headerRow(candidate, dimensions, true)

    if (
      !straightRow.snapped &&
      !shiftedRow.snapped &&
      !hasInvalidCutBrick(straightRow) &&
      !hasInvalidCutBrick(shiftedRow)
    ) {
      return Math.max(straightRow.renderedL, shiftedRow.renderedL)
    }
  }

  return wallL
}

function generate({ wallL, wallH, brickDimensions }: BondParams): BondResult {
  const dimensions = brickDimensions ?? DEFAULT_BRICK_DIMENSIONS
  const courseH = dimensions.height + dimensions.mortar
  const nRows = Math.ceil((wallH + dimensions.mortar) / courseH)
  const wallPixH = nRows * courseH - dimensions.mortar
  const targetWallL = snapHeaderWallLength(wallL, dimensions)

  const bricks: BrickData[] = []
  let brickCount = 0
  let wallPixW = targetWallL
  let adjPieceLength = 0
  let snapped = targetWallL !== wallL

  for (let r = 0; r < nRows; r++) {
    const rowResult = headerRow(targetWallL, dimensions, r % 2 === 1)
    wallPixW = Math.max(wallPixW, rowResult.renderedL)
    adjPieceLength = Math.max(adjPieceLength, rowResult.adjPieceLength)
    snapped = snapped || rowResult.snapped
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
    adjPieceLength,
    snapped,
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
