import type { BondPattern, BondParams, BondResult, BrickData } from './types'
import { DEFAULT_BRICK_DIMENSIONS, type BrickDimensions } from './brickDimensions'
import { snapWallLengthForCutRule } from './cutRules'

interface RowElem {
  x: number
  w: number
  type: 'full' | 'half' | 'adj'
}

interface RowResult {
  elems: RowElem[]
  renderedL: number
}

function stretcherRow(wallL: number, dimensions: BrickDimensions): RowResult {
  const { length: brickL, mortar } = dimensions
  const elems: RowElem[] = []
  let x = 0

  while (x < wallL) {
    const remaining = wallL - x
    const w = Math.min(brickL, remaining)
    elems.push({ x: Math.round(x), w: Math.round(w), type: w === brickL ? 'full' : 'adj' })
    x += w

    if (wallL - x <= mortar) break
    x += mortar
  }

  const last = elems[elems.length - 1]
  return { elems, renderedL: last.x + last.w }
}

function headerRow(wallL: number, dimensions: BrickDimensions): RowResult {
  const { length: brickL, width: brickW, mortar } = dimensions
  const queenCloser = Math.max(1, (brickL - brickW) / 2 - mortar)
  const elems: RowElem[] = []
  let x = 0

  if (queenCloser < wallL) {
    elems.push({ x: 0, w: Math.round(queenCloser), type: 'adj' })
    x = queenCloser + mortar
  }

  while (x < wallL) {
    const remaining = wallL - x
    const w = Math.min(brickW, remaining)
    elems.push({ x: Math.round(x), w: Math.round(w), type: w === brickW ? 'full' : 'adj' })
    x += w

    if (wallL - x <= mortar) break
    x += mortar
  }

  const last = elems[elems.length - 1]
  return { elems, renderedL: last.x + last.w }
}

export function generateEnglishBay({ wallL, wallH, brickDimensions }: BondParams): BondResult {
  const dimensions = brickDimensions ?? DEFAULT_BRICK_DIMENSIONS
  const courseH = dimensions.height + dimensions.mortar
  const nRows = Math.ceil((wallH + dimensions.mortar) / courseH)
  const wallPixH = nRows * courseH - dimensions.mortar
  const targetWallL = snapWallLengthForCutRule(wallL, dimensions, (candidateWallL) => [
    stretcherRow(candidateWallL, dimensions),
    headerRow(candidateWallL, dimensions),
  ])

  const bricks: BrickData[] = []
  let brickCount = 0
  let wallPixW = 0
  let adjPieceLength = 0

  for (let r = 0; r < nRows; r++) {
    const isOdd = r % 2 === 0
    const rowResult = isOdd ? stretcherRow(targetWallL, dimensions) : headerRow(targetWallL, dimensions)
    wallPixW = Math.max(wallPixW, rowResult.renderedL)
    adjPieceLength = Math.max(
      adjPieceLength,
      ...rowResult.elems
        .filter((elem) => elem.type === 'adj')
        .map((elem) => elem.w),
      0,
    )
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
    snapped: targetWallL !== wallL,
  }
}

function generate(params: BondParams): BondResult {
  return generateEnglishBay(params)
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
