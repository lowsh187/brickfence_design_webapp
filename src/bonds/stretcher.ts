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
  snapped: boolean
  ph: number
  renderedL: number
}

function oddRow(wallL: number, dimensions: BrickDimensions): RowResult {
  const { length: brickL, mortar } = dimensions
  const unit = brickL + mortar
  const n = Math.max(1, Math.floor((wallL + mortar) / unit))
  const natural = n * brickL + (n - 1) * mortar
  let delta = wallL - natural

  let snapped = false
  if (delta > 0 && delta < 2 * mortar) {
    snapped = true
    delta = delta <= mortar ? 0 : 2 * mortar
  }

  const ph = delta >= 2 * mortar ? delta / 2 - mortar : 0
  const expanded = delta >= 2 * mortar

  const elems: RowElem[] = []
  let x = 0
  for (let i = 0; i < n; i++) {
    elems.push({ x: Math.round(x), w: brickL, type: 'full' })
    x += brickL
    if (i < n - 1) {
      const endJoint = i === 0 || i === n - 2
      if (endJoint && expanded) {
        x += mortar
        if (ph > 0) {
          elems.push({ x: Math.round(x), w: Math.round(ph), type: 'adj' })
          x += ph
        }
        x += mortar
      } else {
        x += mortar
      }
    }
  }
  const last = elems[elems.length - 1]
  return { elems, snapped, ph, renderedL: last.x + last.w }
}

function evenRow(wallL: number, dimensions: BrickDimensions): RowResult {
  const { length: brickL, width: brickW, mortar } = dimensions
  const unit = brickL + mortar
  const inner = wallL - 2 * brickW - 2 * mortar

  if (inner <= 0) {
    return {
      elems: [
        { x: 0, w: brickW, type: 'half' },
        { x: wallL - brickW, w: brickW, type: 'half' },
      ],
      snapped: false,
      ph: 0,
      renderedL: wallL,
    }
  }

  const nFull = Math.max(0, Math.floor((inner + mortar) / unit))
  const natI = nFull * brickL + Math.max(0, nFull - 1) * mortar
  let delta = inner - natI

  let snapped = false
  if (delta > 0 && delta < 2 * mortar) {
    snapped = true
    delta = delta <= mortar ? 0 : 2 * mortar
  }

  const ph = delta >= 2 * mortar ? delta / 2 - mortar : 0
  const expanded = delta >= 2 * mortar

  const elems: RowElem[] = []
  elems.push({ x: 0, w: brickW, type: 'half' })
  let x = brickW + mortar

  if (expanded) {
    if (ph > 0) {
      elems.push({ x: Math.round(x), w: Math.round(ph), type: 'adj' })
      x += ph
    }
    x += mortar
  }

  for (let i = 0; i < nFull; i++) {
    elems.push({ x: Math.round(x), w: brickL, type: 'full' })
    x += brickL
    if (i < nFull - 1) x += mortar
  }
  if (nFull > 0) x += mortar

  if (expanded) {
    if (ph > 0) {
      elems.push({ x: Math.round(x), w: Math.round(ph), type: 'adj' })
      x += ph
    }
    x += mortar
  }

  elems.push({ x: Math.round(x), w: brickW, type: 'half' })
  const last = elems[elems.length - 1]
  return { elems, snapped, ph, renderedL: last.x + last.w }
}

function generate({ wallL, wallH, brickDimensions }: BondParams): BondResult {
  const dimensions = brickDimensions ?? DEFAULT_BRICK_DIMENSIONS
  const courseH = dimensions.height + dimensions.mortar
  const nRows = Math.ceil((wallH + dimensions.mortar) / courseH)
  const targetWallL = snapWallLengthForCutRule(wallL, dimensions, (candidateWallL) => [
    oddRow(candidateWallL, dimensions),
    evenRow(candidateWallL, dimensions),
  ])
  const OR = oddRow(targetWallL, dimensions)
  const ER = evenRow(targetWallL, dimensions)
  const wallPixH = nRows * courseH - dimensions.mortar

  const bricks: BrickData[] = []
  let brickCount = 0

  for (let r = 0; r < nRows; r++) {
    const isOdd = r % 2 === 0
    const tpl = isOdd ? OR.elems : ER.elems
    const y = wallPixH - ((r + 1) * courseH - dimensions.mortar)
    for (const b of tpl) {
      bricks.push({ x: b.x, y, w: b.w, h: dimensions.height, row: r, type: b.type })
      if (b.type !== 'adj') brickCount++
    }
  }

  return {
    bricks,
    wallW: Math.max(OR.renderedL, ER.renderedL),
    wallH: wallPixH,
    nRows,
    brickCount,
    adjPieceLength: Math.max(OR.ph, ER.ph),
    snapped: OR.snapped || ER.snapped || targetWallL !== wallL,
  }
}

const STRETCHER_ICON = `<svg viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <rect width="80" height="40" fill="#c9b89a"/>
  <rect x="1" y="1" width="38" height="18" rx="1" fill="#b85530" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="41" y="1" width="38" height="18" rx="1" fill="#a34525" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="20" y="21" width="38" height="18" rx="1" fill="#c05838" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="-18" y="21" width="36" height="18" rx="1" fill="#9e3f20" stroke="#6a2208" stroke-width="0.4"/>
  <rect x="60" y="21" width="19" height="18" rx="1" fill="#ba5c35" stroke="#6a2208" stroke-width="0.4"/>
</svg>`

export const stretcherBond: BondPattern = {
  id: 'stretcher',
  nameKey: 'bond.stretcher',
  descKey: 'bond.stretcherDesc',
  iconSvg: STRETCHER_ICON,
  generate,
}
