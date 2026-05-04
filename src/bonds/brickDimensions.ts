export interface BrickDimensions {
  length: number
  width: number
  height: number
  mortar: number
}

export const DEFAULT_BRICK_DIMENSIONS: BrickDimensions = {
  length: 230,
  width: 110,
  height: 76,
  mortar: 10,
}

export const MIN_BRICK_WIDTH = 50
export const MIN_CUT_BRICK_DIMENSION = 50

export function validateBrickDimensions(dimensions: BrickDimensions): boolean {
  const { length, width, height, mortar } = dimensions
  if (length <= 0 || width < MIN_BRICK_WIDTH || height <= 0 || mortar <= 0) return false
  return length === width * 2 + mortar
}

export function brickDimensionsFromStrings(values: {
  brickSizeMode?: string
  brickLength: string
  brickWidth: string
  brickHeight: string
  mortarJoint: string
}): BrickDimensions {
  if (values.brickSizeMode !== 'custom') return DEFAULT_BRICK_DIMENSIONS

  return {
    length: parseFloat(values.brickLength) || DEFAULT_BRICK_DIMENSIONS.length,
    width: parseFloat(values.brickWidth) || DEFAULT_BRICK_DIMENSIONS.width,
    height: parseFloat(values.brickHeight) || DEFAULT_BRICK_DIMENSIONS.height,
    mortar: parseFloat(values.mortarJoint) || DEFAULT_BRICK_DIMENSIONS.mortar,
  }
}
