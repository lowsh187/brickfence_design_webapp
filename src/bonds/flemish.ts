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

function appendPiece(
  elems: RowElem[],
  x: number,
  w: number,
  dimensions: BrickDimensions,
  type?: RowElem['type'],
): number {
  if (w <= 0) return x
  elems.push({
    x: Math.round(x),
    w: Math.round(w),
    type: type ?? (w <= dimensions.width ? 'half' : 'full'),
  })
  return x + w
}

function buildRow(
  wallL: number,
  dimensions: BrickDimensions,
  startsWithHeader: boolean,
): RowResult {
  const { length: brickL, width: brickW, mortar } = dimensions
  const queenCloser = Math.max(1, (brickL - brickW) / 2 - mortar)
  const elems: RowElem[] = []
  let x = 0
  let adjPieceLength = 0
  let nextIsHeader = startsWithHeader

  if (startsWithHeader) {
    x = appendPiece(elems, x, Math.min(brickW, wallL), dimensions, 'half')
    if (wallL - x > mortar) {
      x += mortar
      const remaining = wallL - x
      if (remaining > 0) {
        const w = Math.min(queenCloser, remaining)
        adjPieceLength = Math.max(adjPieceLength, w)
        x = appendPiece(elems, x, w, dimensions, 'adj')
        if (wallL - x > mortar) x += mortar
      }
    }
    nextIsHeader = false
  } else {
    const startCloser = Math.round((brickL - queenCloser) / 2)
    const w = Math.min(startCloser, wallL)
    adjPieceLength = Math.max(adjPieceLength, w)
    x = appendPiece(elems, x, w, dimensions, 'adj')
    if (wallL - x > mortar) x += mortar
    nextIsHeader = true
  }

  while (x < wallL) {
    const targetW = nextIsHeader ? brickW : brickL
    const remaining = wallL - x

    if (remaining >= targetW) {
      x = appendPiece(elems, x, targetW, dimensions, nextIsHeader ? 'half' : 'full')
    } else {
      adjPieceLength = Math.max(adjPieceLength, remaining)
      x = appendPiece(elems, x, remaining, dimensions, 'adj')
      break
    }

    if (wallL - x <= mortar) break
    x += mortar
    nextIsHeader = !nextIsHeader
  }

  const last = elems[elems.length - 1]
  return { elems, renderedL: last ? last.x + last.w : 0, adjPieceLength }
}

function generate({ wallL, wallH, brickDimensions }: BondParams): BondResult {
  const dimensions = brickDimensions ?? DEFAULT_BRICK_DIMENSIONS
  const courseH = dimensions.height + dimensions.mortar
  const nRows = Math.ceil((wallH + dimensions.mortar) / courseH)
  const wallPixH = nRows * courseH - dimensions.mortar
  const odd = buildRow(wallL, dimensions, true)
  const even = buildRow(wallL, dimensions, false)

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
    snapped: false,
  }
}

const FLEMISH_ICON = `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <rect width="80" height="40" fill="#c9b89a"/>
  <rect x="1" y="1" width="10" height="18" rx="1" fill="#8f391b" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="13" y="1" width="5" height="18" rx="1" fill="#d49050" stroke="#9a5010" stroke-width="0.4"/>
  <rect x="20" y="1" width="22" height="18" rx="1" fill="#b85530" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="44" y="1" width="10" height="18" rx="1" fill="#a34525" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="56" y="1" width="22" height="18" rx="1" fill="#c05838" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="1" y="21" width="17" height="18" rx="1" fill="#d49050" stroke="#9a5010" stroke-width="0.4"/>
  <rect x="20" y="21" width="10" height="18" rx="1" fill="#9e3f20" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="32" y="21" width="22" height="18" rx="1" fill="#ba5c35" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="56" y="21" width="10" height="18" rx="1" fill="#aa4a2c" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="68" y="21" width="10" height="18" rx="1" fill="#8f391b" stroke="#6a2208" stroke-width="0.4"/>
</svg>`

export const flemishBond: BondPattern = {
  id: 'flemish',
  nameKey: 'bond.flemish',
  descKey: 'bond.flemishDesc',
  iconSvg: FLEMISH_ICON,
  generate,
}
