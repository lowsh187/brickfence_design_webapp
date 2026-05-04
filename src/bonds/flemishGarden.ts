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

function appendPiece(
  elems: RowElem[],
  x: number,
  w: number,
  dimensions: BrickDimensions,
  type?: RowElem['type'],
): number {
  elems.push({
    x: Math.round(x),
    w: Math.round(w),
    type: type ?? (w === dimensions.width ? 'half' : 'full'),
  })
  return x + w
}

function renderedLength(elems: RowElem[]): number {
  if (elems.length === 0) return 0
  const last = elems[elems.length - 1]
  return last.x + last.w
}

function appendRepeatingPattern(
  elems: RowElem[],
  startX: number,
  wallL: number,
  pattern: number[],
  dimensions: BrickDimensions,
): { renderedL: number; adjPieceLength: number } {
  let x = startX
  let patternIndex = 0
  let adjPieceLength = 0

  while (x < wallL) {
    const w = pattern[patternIndex % pattern.length]
    const remaining = wallL - x

    if (remaining >= w) {
      x = appendPiece(elems, x, w, dimensions)
    } else {
      adjPieceLength = remaining
      x = appendPiece(elems, x, remaining, dimensions, 'adj')
      break
    }

    if (wallL - x <= dimensions.mortar) break
    x += dimensions.mortar
    patternIndex++
  }

  return {
    renderedL: renderedLength(elems),
    adjPieceLength,
  }
}

function oddRow(wallL: number, dimensions: BrickDimensions): RowResult {
  const { length: brickL, width: brickW } = dimensions
  const elems: RowElem[] = []
  const result = appendRepeatingPattern(
    elems,
    0,
    wallL,
    [brickL, brickL, brickL, brickW],
    dimensions,
  )

  return {
    elems,
    snapped: false,
    adjPieceLength: result.adjPieceLength,
    renderedL: result.renderedL,
  }
}

function evenRow(wallL: number, dimensions: BrickDimensions): RowResult {
  const { length: brickL, width: brickW, mortar } = dimensions
  const startAdj = Math.round((brickL + brickW) / 2)
  const elems: RowElem[] = []
  let x = 0

  const prefix: Array<{ w: number; type?: RowElem['type'] }> = [
    { w: brickW, type: 'half' },
    { w: startAdj, type: 'adj' },
    { w: brickW, type: 'half' },
  ]

  for (const piece of prefix) {
    if (x >= wallL) break
    const remaining = wallL - x
    if (remaining < piece.w) {
      x = appendPiece(elems, x, remaining, dimensions, 'adj')
      break
    }
    x = appendPiece(elems, x, piece.w, dimensions, piece.type)
    if (wallL - x <= mortar) break
    x += mortar
  }

  const result = appendRepeatingPattern(
    elems,
    x,
    wallL,
    [brickL, brickL, brickL, brickW],
    dimensions,
  )

  return {
    elems,
    snapped: false,
    adjPieceLength: result.adjPieceLength,
    renderedL: result.renderedL,
  }
}

function generate({ wallL, wallH, brickDimensions }: BondParams): BondResult {
  const dimensions = brickDimensions ?? DEFAULT_BRICK_DIMENSIONS
  const courseH = dimensions.height + dimensions.mortar
  const nRows = Math.ceil((wallH + dimensions.mortar) / courseH)
  const wallPixH = nRows * courseH - dimensions.mortar

  const odd = oddRow(wallL, dimensions)
  const even = evenRow(wallL, dimensions)

  const bricks: BrickData[] = []
  let brickCount = 0

  for (let r = 0; r < nRows; r++) {
    const row = r % 2 === 0 ? odd : even
    const y = wallPixH - ((r + 1) * courseH - dimensions.mortar)

    for (const b of row.elems) {
      bricks.push({ x: b.x, y, w: b.w, h: dimensions.height, row: r, type: b.type })
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
