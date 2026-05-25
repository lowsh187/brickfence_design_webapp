import { describe, expect, it } from 'vitest'

import { DEFAULT_BRICK_DIMENSIONS, MIN_CUT_BRICK_DIMENSION } from './brickDimensions'
import { generateEnglishBay } from './english'

describe('generateEnglishBay', () => {
  it('snaps wall length forward when an adjustment brick would be too short', () => {
    const result = generateEnglishBay({
      wallL: 270,
      wallH: 500,
      brickDimensions: DEFAULT_BRICK_DIMENSIONS,
    })

    const adjustmentBricks = result.bricks.filter((brick) => brick.type === 'adj')

    expect(result.snapped).toBe(true)
    expect(result.wallW).toBeGreaterThan(270)
    expect(
      adjustmentBricks.every((brick) => brick.w >= MIN_CUT_BRICK_DIMENSION),
    ).toBe(true)
  })
})
