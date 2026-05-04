import type { BrickDimensions } from './brickDimensions'

export type BrickType = 'full' | 'half' | 'adj'

export interface BrickData {
  x: number
  y: number
  w: number
  h: number
  row: number
  type: BrickType
}

export interface BondResult {
  bricks: BrickData[]
  wallW: number
  wallH: number
  nRows: number
  brickCount: number
  adjPieceLength: number
  snapped: boolean
}

export interface BondParams {
  wallL: number
  wallH: number
  brickDimensions?: BrickDimensions
}

export interface BondPattern {
  id: string
  nameKey: string
  descKey: string
  iconSvg: string
  generate: (params: BondParams) => BondResult
}
