import { MIN_CUT_BRICK_DIMENSION, type BrickDimensions } from './brickDimensions'

interface CutCandidate {
  elems: Array<{
    w: number
    type: string
  }>
}

export function hasInvalidCutBrick(candidate: CutCandidate): boolean {
  return candidate.elems.some(
    (elem) => elem.type === 'adj' && elem.w < MIN_CUT_BRICK_DIMENSION,
  )
}

export function snapWallLengthForCutRule(
  wallL: number,
  dimensions: BrickDimensions,
  buildCandidates: (candidateWallL: number) => CutCandidate[],
): number {
  const searchLimit = Math.max(
    2000,
    (dimensions.length + dimensions.mortar) * 8,
    (dimensions.width + dimensions.mortar) * 12,
  )

  for (let offset = 0; offset <= searchLimit; offset++) {
    const candidateWallL = wallL + offset
    const candidates = buildCandidates(candidateWallL)
    if (candidates.every((candidate) => !hasInvalidCutBrick(candidate))) {
      return candidateWallL
    }
  }

  return wallL
}
