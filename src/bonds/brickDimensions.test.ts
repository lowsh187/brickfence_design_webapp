import { describe, expect, it } from 'vitest'

import {
  brickDimensionsFromStrings,
  DEFAULT_BRICK_DIMENSIONS,
  MIN_BRICK_WIDTH,
  validateBrickDimensions,
} from './brickDimensions'

describe('validateBrickDimensions', () => {
  it('accepts the default brick dimensions', () => {
    expect(validateBrickDimensions(DEFAULT_BRICK_DIMENSIONS)).toBe(true)
  })

  it('rejects a brick width below the minimum', () => {
    expect(
      validateBrickDimensions({
        ...DEFAULT_BRICK_DIMENSIONS,
        width: MIN_BRICK_WIDTH - 1,
      }),
    ).toBe(false)
  })

  it('rejects dimensions where length is not width * 2 + mortar', () => {
    expect(
      validateBrickDimensions({
        ...DEFAULT_BRICK_DIMENSIONS,
        length: DEFAULT_BRICK_DIMENSIONS.length + 1,
      }),
    ).toBe(false)
  })

  it('rejects non-positive height values', () => {
    expect(
      validateBrickDimensions({
        ...DEFAULT_BRICK_DIMENSIONS,
        height: 0,
      }),
    ).toBe(false)
  })

  it('rejects non-positive mortar values', () => {
    expect(
      validateBrickDimensions({
        ...DEFAULT_BRICK_DIMENSIONS,
        mortar: 0,
      }),
    ).toBe(false)
  })
})

describe('brickDimensionsFromStrings', () => {
  it('parses numeric strings in custom mode', () => {
    expect(
      brickDimensionsFromStrings({
        brickSizeMode: 'custom',
        brickLength: '230',
        brickWidth: '110',
        brickHeight: '76',
        mortarJoint: '10',
      }),
    ).toEqual(DEFAULT_BRICK_DIMENSIONS)
  })

  it('parses decimal and space-padded values in custom mode', () => {
    expect(
      brickDimensionsFromStrings({
        brickSizeMode: 'custom',
        brickLength: ' 230.5 ',
        brickWidth: '110.25',
        brickHeight: '76.75',
        mortarJoint: '10.5',
      }),
    ).toEqual({
      length: 230.5,
      width: 110.25,
      height: 76.75,
      mortar: 10.5,
    })
  })

  it('returns default dimensions outside custom mode', () => {
    expect(
      brickDimensionsFromStrings({
        brickSizeMode: 'default',
        brickLength: '999',
        brickWidth: '999',
        brickHeight: '999',
        mortarJoint: '999',
      }),
    ).toEqual(DEFAULT_BRICK_DIMENSIONS)
  })

  it('falls back only for the invalid custom fields', () => {
    expect(
      brickDimensionsFromStrings({
        brickSizeMode: 'custom',
        brickLength: '230',
        brickWidth: 'abc',
        brickHeight: '76',
        mortarJoint: '10',
      }),
    ).toEqual({
      length: 230,
      width: DEFAULT_BRICK_DIMENSIONS.width,
      height: 76,
      mortar: 10,
    })
  })

  it('falls back to defaults for empty custom inputs', () => {
    expect(
      brickDimensionsFromStrings({
        brickSizeMode: 'custom',
        brickLength: '',
        brickWidth: '',
        brickHeight: '',
        mortarJoint: '',
      }),
    ).toEqual(DEFAULT_BRICK_DIMENSIONS)
  })

  it('falls back to defaults for invalid custom inputs', () => {
    expect(
      brickDimensionsFromStrings({
        brickSizeMode: 'custom',
        brickLength: 'abc',
        brickWidth: 'def',
        brickHeight: 'ghi',
        mortarJoint: 'xyz',
      }),
    ).toEqual(DEFAULT_BRICK_DIMENSIONS)
  })

  it('falls back for zero values because they are falsy after parsing', () => {
    expect(
      brickDimensionsFromStrings({
        brickSizeMode: 'custom',
        brickLength: '0',
        brickWidth: '0',
        brickHeight: '0',
        mortarJoint: '0',
      }),
    ).toEqual(DEFAULT_BRICK_DIMENSIONS)
  })

  it('keeps negative parsed numbers in custom mode', () => {
    expect(
      brickDimensionsFromStrings({
        brickSizeMode: 'custom',
        brickLength: '-230',
        brickWidth: '-110',
        brickHeight: '-76',
        mortarJoint: '-10',
      }),
    ).toEqual({
      length: -230,
      width: -110,
      height: -76,
      mortar: -10,
    })
  })
})
