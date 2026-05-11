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
  adjPieceLength: number
}

function appendPiece(elems: RowElem[], x: number, w: number, type: RowElem['type']): number {
  if (w <= 0) return x
  elems.push({ x: Math.round(x), w: Math.round(w), type })
  return x + w
}

function headerRow(wallL: number, dimensions: BrickDimensions): RowResult {
  const { width: brickW, mortar } = dimensions
  const elems: RowElem[] = []
  let x = 0
  let adjPieceLength = 0

  while (x < wallL) {
    const remaining = wallL - x
    if (remaining >= brickW) {
      x = appendPiece(elems, x, brickW, 'full')
    } else {
      adjPieceLength = remaining
      x = appendPiece(elems, x, remaining, 'adj')
      break
    }

    if (wallL - x <= mortar) break
    x += mortar
  }

  const last = elems[elems.length - 1]
  return { elems, renderedL: last ? last.x + last.w : 0, adjPieceLength }
}

function stretcherRow(wallL: number, dimensions: BrickDimensions, startRatio: number): RowResult {
  const { length: brickL, mortar } = dimensions
  const startPart = (brickL - mortar) * startRatio
  const elems: RowElem[] = []
  let x = 0
  let adjPieceLength = 0

  if (startPart > 0) {
    const w = Math.min(startPart, wallL)
    adjPieceLength = w
    x = appendPiece(elems, x, w, 'adj')
    if (wallL - x <= mortar) {
      const last = elems[elems.length - 1]
      return { elems, renderedL: last ? last.x + last.w : 0, adjPieceLength }
    }
    x += mortar
  }

  while (x < wallL) {
    const remaining = wallL - x
    if (remaining >= brickL) {
      x = appendPiece(elems, x, brickL, 'full')
    } else {
      adjPieceLength = Math.max(adjPieceLength, remaining)
      x = appendPiece(elems, x, remaining, 'adj')
      break
    }

    if (wallL - x <= mortar) break
    x += mortar
  }

  const last = elems[elems.length - 1]
  return { elems, renderedL: last ? last.x + last.w : 0, adjPieceLength }
}

function rowForCourse(row: number, wallL: number, dimensions: BrickDimensions): RowResult {
  switch (row % 4) {
    case 0:
      return headerRow(wallL, dimensions)
    case 2:
      return stretcherRow(wallL, dimensions, 0.75)
    default:
      return stretcherRow(wallL, dimensions, 0.25)
  }
}

function generate({ wallL, wallH, brickDimensions }: BondParams): BondResult {
  const dimensions = brickDimensions ?? DEFAULT_BRICK_DIMENSIONS
  const courseH = dimensions.height + dimensions.mortar
  const nRows = Math.ceil((wallH + dimensions.mortar) / courseH)
  const wallPixH = nRows * courseH - dimensions.mortar

  const bricks: BrickData[] = []
  let brickCount = 0
  let wallPixW = 0
  let adjPieceLength = 0

  for (let r = 0; r < nRows; r++) {
    const rowResult = rowForCourse(r, wallL, dimensions)
    wallPixW = Math.max(wallPixW, rowResult.renderedL)
    adjPieceLength = Math.max(adjPieceLength, rowResult.adjPieceLength)
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
    snapped: false,
  }
}

const ENGLISH_GARDEN_ICON = `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <rect width="80" height="40" fill="#c9b89a"/>
  <rect x="1" y="1" width="11" height="8" rx="0.8" fill="#8f391b" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="14" y="1" width="11" height="8" rx="0.8" fill="#a34525" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="27" y="1" width="11" height="8" rx="0.8" fill="#b85530" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="40" y="1" width="11" height="8" rx="0.8" fill="#9e3f20" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="53" y="1" width="11" height="8" rx="0.8" fill="#ba5c35" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="66" y="1" width="11" height="8" rx="0.8" fill="#aa4a2c" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="1" y="11" width="5" height="8" rx="0.8" fill="#d49050" stroke="#9a5010" stroke-width="0.35"/>
  <rect x="8" y="11" width="22" height="8" rx="0.8" fill="#c05838" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="32" y="11" width="22" height="8" rx="0.8" fill="#b85530" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="56" y="11" width="22" height="8" rx="0.8" fill="#a34525" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="1" y="21" width="17" height="8" rx="0.8" fill="#d49050" stroke="#9a5010" stroke-width="0.35"/>
  <rect x="20" y="21" width="22" height="8" rx="0.8" fill="#ba5c35" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="44" y="21" width="22" height="8" rx="0.8" fill="#aa4a2c" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="68" y="21" width="10" height="8" rx="0.8" fill="#d49050" stroke="#9a5010" stroke-width="0.35"/>
  <rect x="1" y="31" width="5" height="8" rx="0.8" fill="#d49050" stroke="#9a5010" stroke-width="0.35"/>
  <rect x="8" y="31" width="22" height="8" rx="0.8" fill="#9e3f20" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="32" y="31" width="22" height="8" rx="0.8" fill="#c05838" stroke="#6a2208" stroke-width="0.35"/>
  <rect x="56" y="31" width="22" height="8" rx="0.8" fill="#b85530" stroke="#6a2208" stroke-width="0.35"/>
</svg>`

export const englishGardenBond: BondPattern = {
  id: 'englishGarden',
  nameKey: 'bond.englishGarden',
  descKey: 'bond.englishGardenDesc',
  iconSvg: ENGLISH_GARDEN_ICON,
  generate,
}
