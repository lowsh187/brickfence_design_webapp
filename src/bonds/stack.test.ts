import { describe, expect, it } from 'vitest'

import { DEFAULT_BRICK_DIMENSIONS } from './brickDimensions'
import { stackBond } from './stack'

describe('stackBond.generate', () => {
  it('returns a valid bond result structure for a typical wall', () => {
    const result = stackBond.generate({
      wallL: 1000,
      wallH: 500,
      brickDimensions: DEFAULT_BRICK_DIMENSIONS,
    })

    expect(result.bricks.length).toBeGreaterThan(0)
    expect(result.nRows).toBeGreaterThan(0)
    expect(result.brickCount).toBeLessThanOrEqual(result.bricks.length)
    expect(result.wallW).toBeGreaterThan(0)
    expect(result.wallH).toBeGreaterThan(0)

    for (const brick of result.bricks) {
      expect(brick.x).toBeGreaterThanOrEqual(0)
      expect(brick.y).toBeGreaterThanOrEqual(0)
      expect(brick.w).toBeGreaterThanOrEqual(0)
      expect(brick.h).toBeGreaterThanOrEqual(0)
      expect(['full', 'half', 'adj']).toContain(brick.type)
    }
  })

  it('calculates wallH from the number of rows and course height', () => {
    const result = stackBond.generate({
      wallL: 1000,
      wallH: 500,
      brickDimensions: DEFAULT_BRICK_DIMENSIONS,
    })

    const courseH = DEFAULT_BRICK_DIMENSIONS.height + DEFAULT_BRICK_DIMENSIONS.mortar
    const expectedWallH = result.nRows * courseH - DEFAULT_BRICK_DIMENSIONS.mortar

    expect(result.wallH).toBe(expectedWallH)
  })

  it('still returns a valid structure for a very small wall', () => {
    const result = stackBond.generate({
      wallL: 40,
      wallH: 40,
      brickDimensions: DEFAULT_BRICK_DIMENSIONS,
    })

    expect(result.nRows).toBeGreaterThan(0)
    expect(result.wallH).toBeGreaterThan(0)
    expect(result.bricks.length).toBeGreaterThanOrEqual(0)

    for (const brick of result.bricks) {
      expect(brick.x).toBeGreaterThanOrEqual(0)
      expect(brick.y).toBeGreaterThanOrEqual(0)
      expect(brick.w).toBeGreaterThanOrEqual(0)
      expect(brick.h).toBeGreaterThanOrEqual(0)
      expect(['full', 'half', 'adj']).toContain(brick.type)
    }
  })

  it('handles a zero-length wall without negative geometry', () => {
    const result = stackBond.generate({
      wallL: 0,
      wallH: 40,
      brickDimensions: DEFAULT_BRICK_DIMENSIONS,
    })

    expect(result.wallW).toBe(0)
    expect(result.bricks).toEqual([])
    expect(result.brickCount).toBe(0)
    expect(result.nRows).toBeGreaterThan(0)
    expect(result.wallH).toBeGreaterThan(0)
  })

  it('handles a zero-height wall according to the current row calculation rule', () => {
    const result = stackBond.generate({
      wallL: 1000,
      wallH: 0,
      brickDimensions: DEFAULT_BRICK_DIMENSIONS,
    })

    expect(result.nRows).toBe(1)
    expect(result.wallH).toBe(DEFAULT_BRICK_DIMENSIONS.height)
    expect(result.bricks.length).toBeGreaterThan(0)
    expect(result.brickCount).toBeGreaterThan(0)
  })
})
