import { useRef, useState, useEffect, useMemo } from 'react'
import { Stage, Layer, Rect, Group, Line } from 'react-konva'
import { getBond } from '../bonds/registry'
import type { BrickData } from '../bonds/types'
import { DEFAULT_BRICK_DIMENSIONS, type BrickDimensions } from '../bonds/brickDimensions'

const MIN_CANVAS_H = 520
const MAX_CANVAS_H = 980
const HORIZONTAL_PADDING = 36
const VERTICAL_PADDING = 56
const PIER_EXTRA_HEIGHT_MM = 180
const TIMBER_FROM_WALL_TOP_MM = 36
const TIMBER_RAIL_GAP_MM = 90
const MAX_PIER_SPACING_MM = 3000
const MORTAR_FILL = '#c9b89a'
const ADJ_FILL = '#d49050'
const PIER_STROKE = '#4e3426'
const PIER_SIDE_SHADOW = 'rgba(47,29,20,0.26)'
const EXPOSED_PIER_EDGE = '#2f1d14'
const EXPOSED_PIER_HIGHLIGHT = 'rgba(255,236,190,0.34)'
const TIMBER_STROKE = '#d9b43b'
const PVC_STROKE = '#f2f2f2'
const PVC_FILL = '#fbfbf7'
const PVC_STROKE_SOFT = '#d6d6ce'
const STRETCHER_PALETTE = [
  '#b85530',
  '#a34525',
  '#c05838',
  '#9e3f20',
  '#ba5c35',
  '#aa4a2c',
]
const STROKE_NORMAL = '#6a2208'
const STROKE_ADJ = '#9a5010'
const SHEEN_FILL = 'rgba(255,230,180,0.12)'
interface FenceDiagramProps {
  lengthM: number
  heightM: number
  bondPattern?: string
  pierType?: string
  pierSize?: string
  pierHeightM?: number
  pierSpacingM?: number
  cutBricks?: string
  timberFence?: string
  brickDimensions?: BrickDimensions
}

interface PierSpec {
  frontWidth: number
  oddCourse: number[]
  evenCourse: number[]
}

interface PierLayout {
  center: number
  left: number
  width: number
}

interface WallSegment {
  left: number
  width: number
  top: number
  height: number
  bricks: BrickData[]
}

interface SnappedBond {
  wallW: number
  wallH: number
  bricks: BrickData[]
}

interface StructureLayout {
  renderedW: number
  renderedH: number
  piers: PierLayout[]
  wallSegments: WallSegment[]
}

interface IndexedPierLayout extends PierLayout {
  index: number
}

function buildStackAlignedPierLayouts(
  renderedW: number,
  pierWidth: number,
  bayCount: number,
  brickModule: number,
): PierLayout[] {
  const maxLeft = renderedW - pierWidth
  if (maxLeft <= 0) {
    return [{ center: renderedW / 2, left: 0, width: pierWidth }]
  }

  const validLefts: number[] = []
  for (let left = 0; left <= maxLeft + 0.001; left += brickModule) {
    validLefts.push(Math.min(maxLeft, Math.round(left)))
  }

  const pierCount = Math.max(2, bayCount + 1)
  const layouts: PierLayout[] = []
  let previousIndex = -1

  for (let idx = 0; idx < pierCount; idx++) {
    const remaining = pierCount - idx - 1
    let selectedIndex: number

    if (idx === 0) {
      selectedIndex = 0
    } else if (idx === pierCount - 1) {
      selectedIndex = validLefts.length - 1
    } else {
      const desiredLeft = (idx * maxLeft) / (pierCount - 1)
      const minIndex = previousIndex + 1
      const maxIndex = validLefts.length - 1 - remaining
      selectedIndex = minIndex

      for (let candidate = minIndex; candidate <= maxIndex; candidate++) {
        if (
          Math.abs(validLefts[candidate] - desiredLeft) <
          Math.abs(validLefts[selectedIndex] - desiredLeft)
        ) {
          selectedIndex = candidate
        }
      }
    }

    previousIndex = selectedIndex
    const left = validLefts[selectedIndex]
    layouts.push({
      center: left + pierWidth / 2,
      left,
      width: pierWidth,
    })
  }

  return layouts
}

function buildPierSpecs(
  dimensions: BrickDimensions,
  bondPattern: string,
): Record<string, PierSpec> {
  const { length: brickL, width: brickW, mortar } = dimensions
  const twoBrickPierOddCourse = [brickL, brickL]
  const twoBrickPierEvenCourse =
    bondPattern === 'stack' ? twoBrickPierOddCourse : [brickW, brickL, brickW]

  return {
    '1_5x1': {
      frontWidth: brickL + mortar + brickW,
      oddCourse: [brickL, brickW],
      evenCourse: [brickW, brickL],
    },
    '1_5x1_5': {
      frontWidth: brickL + mortar + brickW,
      oddCourse: [brickL, brickW],
      evenCourse: [brickW, brickL],
    },
    '2x1': {
      frontWidth: brickL + mortar + brickL,
      oddCourse: twoBrickPierOddCourse,
      evenCourse: twoBrickPierEvenCourse,
    },
    '2x2': {
      frontWidth: brickL + mortar + brickL,
      oddCourse: twoBrickPierOddCourse,
      evenCourse: twoBrickPierEvenCourse,
    },
  }
}

function hashNoise(row: number, index: number): number {
  const h = Math.sin(row * 91.3 + index * 7.17) * 43758.5453
  const frac = h - Math.floor(h)
  return (frac - 0.5) * 0.18
}

function adjustBrightness(hex: string, amount: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.substring(0, 2), 16)
  const g = parseInt(m.substring(2, 4), 16)
  const b = parseInt(m.substring(4, 6), 16)
  const d = Math.round(amount * 255)
  const clamp = (v: number) => Math.max(0, Math.min(255, v + d))
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function brickFill(b: BrickData, idx: number): string {
  if (b.type === 'adj') return adjustBrightness(ADJ_FILL, hashNoise(b.row, idx))
  if (b.type === 'half') {
    const base = b.row % 2 === 0 ? '#6e2c12' : '#7e3418'
    return adjustBrightness(base, hashNoise(b.row, idx))
  }
  const base = STRETCHER_PALETTE[b.row % STRETCHER_PALETTE.length]
  return adjustBrightness(base, hashNoise(b.row, idx))
}

function generatePierFace(
  spec: PierSpec,
  targetHeightMm: number,
  dimensions: BrickDimensions,
): {
  bricks: BrickData[]
  width: number
  height: number
} {
  const courseH = dimensions.height + dimensions.mortar
  const nRows = Math.max(1, Math.ceil((targetHeightMm + dimensions.mortar) / courseH))
  const height = nRows * courseH - dimensions.mortar
  const bricks: BrickData[] = []

  for (let row = 0; row < nRows; row++) {
    const widths = row % 2 === 0 ? spec.oddCourse : spec.evenCourse
    const y = height - ((row + 1) * courseH - dimensions.mortar)
    let x = 0

    for (let i = 0; i < widths.length; i++) {
      const w = widths[i]
      bricks.push({
        x,
        y,
        w,
        h: dimensions.height,
        row,
        type: w <= dimensions.width ? 'half' : 'full',
      })
      x += w
      if (i < widths.length - 1) x += dimensions.mortar
    }
  }

  return { bricks, width: spec.frontWidth, height }
}

function buildNoCutSearchOffsets(limit: number, mortar: number): number[] {
  const offsets = [0]
  for (let step = mortar; step <= limit; step += mortar) {
    offsets.push(step, -step)
  }
  return offsets
}

function tryGenerateNoCutBond(
  bond: NonNullable<ReturnType<typeof getBond>>,
  targetWallL: number,
  wallH: number,
  dimensions: BrickDimensions,
): SnappedBond | null {
  if (targetWallL <= 0 || wallH <= 0) return null

  const searchLimit = 1600
  const offsets = buildNoCutSearchOffsets(searchLimit, dimensions.mortar)

  for (const offset of offsets) {
    const candidateL = targetWallL + offset
    if (candidateL < dimensions.width) continue

    const result = bond.generate({ wallL: candidateL, wallH, brickDimensions: dimensions })
    if (result.bricks.every((brick) => brick.type !== 'adj')) {
      return {
        wallW: result.wallW,
        wallH: result.wallH,
        bricks: result.bricks,
      }
    }
  }

  return null
}

export default function FenceDiagram({
  lengthM,
  heightM,
  bondPattern,
  pierType,
  pierSize,
  pierHeightM,
  pierSpacingM,
  cutBricks,
  timberFence,
  brickDimensions,
}: FenceDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const wallL = lengthM * 1000
  const wallHmm = heightM * 1000
  const dimensions = brickDimensions ?? DEFAULT_BRICK_DIMENSIONS
  const brickModule = dimensions.length + dimensions.mortar

  const pierTypeSafe = pierType ?? 'none'
  const bondPatternSafe = bondPattern ?? 'stretcher'
  const requestedPierSize = pierSize ?? '1_5x1_5'
  const pierSizeSafe =
    bondPatternSafe === 'stack' &&
    pierTypeSafe === 'hidden' &&
    requestedPierSize !== '2x1' &&
    requestedPierSize !== '2x2'
      ? '2x1'
      : (bondPatternSafe === 'stack' || bondPatternSafe === 'stretcher') &&
        pierTypeSafe === 'exposed' &&
        requestedPierSize !== '2x2'
      ? '2x2'
      : requestedPierSize
  const cutBricksSafe = cutBricks ?? 'allowed'
  const timberFenceSafe = timberFence ?? 'none'
  const bond = getBond(bondPatternSafe) ?? getBond('stretcher')
  const pierSpecs = useMemo(
    () => buildPierSpecs(dimensions, bondPatternSafe),
    [bondPatternSafe, dimensions],
  )
  const pierSpec = pierSpecs[pierSizeSafe] ?? pierSpecs['1_5x1_5']
  const useHiddenStackPier = pierTypeSafe === 'hidden' && bondPatternSafe === 'stack'
  const useHiddenNoCutStretcher15x1 =
    pierTypeSafe === 'hidden' &&
    cutBricksSafe === 'notAllowed' &&
    bondPatternSafe === 'stretcher' &&
    pierSizeSafe === '1_5x1'

  const pierTargetHeightMm = Math.max(
    wallHmm,
    (pierHeightM || 0) > 0 ? (pierHeightM || 0) * 1000 : wallHmm + PIER_EXTRA_HEIGHT_MM,
  )

  const pierFace = useMemo(
    () => generatePierFace(pierSpec, pierTargetHeightMm, dimensions),
    [dimensions, pierSpec, pierTargetHeightMm],
  )

  const layout = useMemo<StructureLayout>(() => {
    if (!bond || wallL <= 0 || wallHmm <= 0) {
      return { renderedW: wallL, renderedH: wallHmm, piers: [], wallSegments: [] }
    }

    const desiredSpacingMm = Math.max(
      brickModule,
      Math.min(MAX_PIER_SPACING_MM, (pierSpacingM || 0) * 1000 || 2800),
    )
    const snappedRequestedSpacingMm = Math.max(
      brickModule,
      Math.round(desiredSpacingMm / brickModule) * brickModule,
    )

    if (pierTypeSafe === 'none') {
      if (cutBricksSafe === 'notAllowed') {
        const snappedBond = tryGenerateNoCutBond(bond, wallL, wallHmm, dimensions)
        if (snappedBond) {
          return {
            renderedW: snappedBond.wallW,
            renderedH: snappedBond.wallH,
            piers: [],
            wallSegments: [{
              left: 0,
              width: snappedBond.wallW,
              top: 0,
              height: snappedBond.wallH,
              bricks: snappedBond.bricks,
            }],
          }
        }
      }

      const bondResult = bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
      return {
        renderedW: bondResult.wallW,
        renderedH: bondResult.wallH,
        piers: [],
        wallSegments: [{
          left: 0,
          width: bondResult.wallW,
          top: 0,
          height: bondResult.wallH,
          bricks: bondResult.bricks,
        }],
      }
    }

    const interiorSpan = Math.max(0, wallL - pierSpec.frontWidth)
    const bayCount = Math.max(1, Math.ceil(interiorSpan / snappedRequestedSpacingMm))

    if (pierTypeSafe === 'hidden') {
      const result =
        cutBricksSafe === 'notAllowed'
          ? tryGenerateNoCutBond(bond, wallL, wallHmm, dimensions) ??
            bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
          : bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
      const renderedW = result.wallW
      const hiddenInteriorSpan = Math.max(0, renderedW - pierSpec.frontWidth)
      const piers: PierLayout[] =
        useHiddenStackPier && cutBricksSafe === 'notAllowed'
          ? buildStackAlignedPierLayouts(
            renderedW,
            pierSpec.frontWidth,
            bayCount,
            brickModule,
          )
          : Array.from({ length: bayCount + 1 }, (_, idx) => {
            const center =
              bayCount === 0
                ? renderedW / 2
                : pierSpec.frontWidth / 2 + (idx * hiddenInteriorSpan) / bayCount
            return {
              center,
              left: Math.max(
                0,
                Math.min(renderedW - pierSpec.frontWidth, center - pierSpec.frontWidth / 2),
              ),
              width: pierSpec.frontWidth,
            }
          })

      return {
        renderedW,
        renderedH: result.wallH,
        piers,
        wallSegments: [{
          left: 0,
          width: renderedW,
          top: 0,
          height: result.wallH,
          bricks: result.bricks,
        }],
      }
    }

    if (useHiddenStackPier) {
      const result =
        cutBricksSafe === 'notAllowed'
          ? tryGenerateNoCutBond(bond, wallL, wallHmm, dimensions) ??
            bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
          : bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
      const renderedW = result.wallW
      const piers =
        cutBricksSafe === 'notAllowed'
          ? buildStackAlignedPierLayouts(
            renderedW,
            pierSpec.frontWidth,
            bayCount,
            brickModule,
          )
          : (() => {
            const stackInteriorSpan = Math.max(0, renderedW - pierSpec.frontWidth)
            return Array.from({ length: bayCount + 1 }, (_, idx) => {
              const center =
                bayCount === 0
                  ? renderedW / 2
                  : pierSpec.frontWidth / 2 + (idx * stackInteriorSpan) / bayCount
              return {
                center,
                left: Math.max(
                  0,
                  Math.min(renderedW - pierSpec.frontWidth, center - pierSpec.frontWidth / 2),
                ),
                width: pierSpec.frontWidth,
              }
            })
          })()

      return {
        renderedW,
        renderedH: result.wallH,
        piers,
        wallSegments: [{
          left: 0,
          width: renderedW,
          top: 0,
          height: result.wallH,
          bricks: result.bricks,
        }],
      }
    }

    if (useHiddenNoCutStretcher15x1) {
      const wallInset = dimensions.width + dimensions.mortar
      const targetWallWidth = Math.max(dimensions.length, wallL - wallInset * 2)
      const snappedWall = tryGenerateNoCutBond(bond, targetWallWidth, wallHmm, dimensions)

      if (snappedWall) {
        const renderedW = snappedWall.wallW + wallInset * 2
        const piers: PierLayout[] = Array.from({ length: bayCount + 1 }, (_, idx) => {
          const center =
            bayCount === 0
              ? renderedW / 2
              : pierSpec.frontWidth / 2 + (idx * (renderedW - pierSpec.frontWidth)) / bayCount
          return {
            center,
            left: center - pierSpec.frontWidth / 2,
            width: pierSpec.frontWidth,
          }
        })

        return {
          renderedW,
          renderedH: snappedWall.wallH,
          piers,
          wallSegments: [{
            left: wallInset,
            width: snappedWall.wallW,
            top: 0,
            height: snappedWall.wallH,
            bricks: snappedWall.bricks.map((brick) => ({
              ...brick,
              x: brick.x + wallInset,
            })),
          }],
        }
      }
    }

    if (cutBricksSafe === 'notAllowed') {
      const targetBayWidth = Math.max(dimensions.width, snappedRequestedSpacingMm - pierSpec.frontWidth)
      const snappedBay = tryGenerateNoCutBond(bond, targetBayWidth, wallHmm, dimensions)

      if (snappedBay) {
        const piers: PierLayout[] = []
        const wallSegments: WallSegment[] = []
        let cursor = 0

        for (let i = 0; i <= bayCount; i++) {
          piers.push({
            center: cursor + pierSpec.frontWidth / 2,
            left: cursor,
            width: pierSpec.frontWidth,
          })
          cursor += pierSpec.frontWidth

          if (i < bayCount) {
            wallSegments.push({
              left: cursor,
              width: snappedBay.wallW,
              top: 0,
              height: snappedBay.wallH,
              bricks: snappedBay.bricks.map((brick) => ({
                ...brick,
                x: brick.x + cursor,
              })),
            })
            cursor += snappedBay.wallW
          }
        }

        return {
          renderedW: cursor,
          renderedH: snappedBay.wallH,
          piers,
          wallSegments,
        }
      }
    }

    const bondResult = bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
    const piers: PierLayout[] = Array.from({ length: bayCount + 1 }, (_, idx) => {
      const center =
        bayCount === 0
          ? wallL / 2
          : (idx * interiorSpan) / bayCount + pierSpec.frontWidth / 2
      const left = Math.max(
        0,
        Math.min(wallL - pierSpec.frontWidth, center - pierSpec.frontWidth / 2),
      )
      return { center, left, width: pierSpec.frontWidth }
    })

    const wallSegments: WallSegment[] = []
    const wallBricks = bondResult.bricks

    if (piers.length < 2) {
      wallSegments.push({
        left: 0,
        width: bondResult.wallW,
        top: 0,
        height: bondResult.wallH,
        bricks: wallBricks,
      })
    } else {
      for (let i = 0; i < piers.length - 1; i++) {
        const current = piers[i]
        const next = piers[i + 1]
        const left = current.left + current.width
        const right = next.left
        const width = Math.max(0, right - left)
        if (width <= 0) continue

        const bricks = wallBricks.flatMap((brick) => {
          const brickLeft = brick.x
          const brickRight = brick.x + brick.w
          const visibleLeft = Math.max(brickLeft, left)
          const visibleRight = Math.min(brickRight, right)
          const visibleWidth = visibleRight - visibleLeft

          if (visibleWidth <= 0) return []

          const clipped = visibleWidth !== brick.w || visibleLeft !== brickLeft
          return [{
            ...brick,
            x: visibleLeft,
            w: visibleWidth,
            type: clipped ? 'adj' : brick.type,
          }]
        })

        wallSegments.push({
          left,
          width,
          top: 0,
          height: bondResult.wallH,
          bricks,
        })
      }
    }

    return {
      renderedW: bondResult.wallW,
      renderedH: bondResult.wallH,
      piers,
      wallSegments,
    }
  }, [
    bond,
    brickModule,
    cutBricksSafe,
    dimensions,
    pierSpacingM,
    pierSpec.frontWidth,
    pierTypeSafe,
    useHiddenStackPier,
    useHiddenNoCutStretcher15x1,
    wallHmm,
    wallL,
  ])

  const renderedW = layout.renderedW
  const renderedH = layout.renderedH
  const piers = layout.piers
  const wallSegments = layout.wallSegments
  const structureH = Math.max(renderedH, pierTypeSafe === 'none' ? 0 : pierFace.height)
  const topRevealMm = Math.max(0, pierFace.height - renderedH)

  const visiblePiers = useMemo<IndexedPierLayout[]>(() => {
    return piers
      .map((pier, index) => ({ ...pier, index }))
      .filter((pier) => pier.left + pier.width > 0 && pier.left < renderedW)
  }, [piers, renderedW])

  const timberRails = useMemo(() => {
    if (pierTypeSafe === 'none' || timberFenceSafe === 'none' || piers.length < 2) return []

    return piers
      .slice(0, -1)
      .map((pier, index) => {
        const nextPier = piers[index + 1]
        return { x1: pier.left + pier.width, x2: nextPier.left }
      })
      .filter((rail) => rail.x2 > rail.x1)
  }, [pierTypeSafe, piers, timberFenceSafe])

  const { scale, canvasH } = useMemo(() => {
    if (containerWidth <= 0 || renderedW <= 0 || structureH <= 0) {
      return { scale: 1, canvasH: MIN_CANVAS_H }
    }
    const availableW = Math.max(120, containerWidth - HORIZONTAL_PADDING * 2)
    const fitWidthScale = availableW / renderedW
    const maxHeightScale = Math.max(0.1, (MAX_CANVAS_H - VERTICAL_PADDING * 2) / structureH)
    const scale = Math.min(fitWidthScale, maxHeightScale)
    const naturalH = structureH * scale
    const canvasH = Math.min(
      MAX_CANVAS_H,
      Math.max(MIN_CANVAS_H, naturalH + VERTICAL_PADDING * 2),
    )
    return { scale, canvasH }
  }, [containerWidth, renderedW, structureH])

  const visibleStructureW =
    containerWidth > 0 && scale > 0
      ? Math.max(0, (containerWidth - HORIZONTAL_PADDING * 2) / scale)
      : renderedW
  const wallFitsInView = renderedW <= visibleStructureW
  const renderW = Math.min(renderedW, visibleStructureW)
  const startX = 0
  const endX = startX + renderW

  const clippedPiers = useMemo(() => {
    return visiblePiers.filter((pier) => pier.left + pier.width > startX && pier.left < endX)
  }, [endX, startX, visiblePiers])

  const clippedSegments = useMemo(() => {
    return wallSegments.filter((segment) => segment.left + segment.width > startX && segment.left < endX)
  }, [endX, startX, wallSegments])

  const clippedRails = useMemo(() => {
    return timberRails.filter((rail) => rail.x2 > startX && rail.x1 < endX)
  }, [endX, startX, timberRails])

  const offsetX = HORIZONTAL_PADDING
  const offsetY = Math.max(VERTICAL_PADDING, (canvasH - structureH * scale) / 2)
  const wallTopY = (structureH - renderedH) * scale
  const timberBottomY = Math.max(0, wallTopY - TIMBER_FROM_WALL_TOP_MM * scale)
  const timberTopY = Math.max(0, timberBottomY - TIMBER_RAIL_GAP_MM * scale)
  const pvcPanelTopY = Math.max(18 * scale, 48 * scale)
  const pvcPanelBottomY = Math.max(pvcPanelTopY + 80 * scale, wallTopY - 12 * scale)

  const strokePx = Math.max(0.5, 0.4 * scale * 4)
  const sheenH = 3 * scale

  if (!containerWidth) {
    return <div ref={containerRef} className="w-full h-8" />
  }

  return (
    <div ref={containerRef} className="w-full relative">
      <Stage width={containerWidth} height={canvasH}>
        <Layer>
          <Group x={offsetX} y={offsetY}>
            {pierTypeSafe !== 'none' &&
              clippedPiers.map((pier, i) => {
                const localX = (pier.left - startX) * scale
                const isExposedPier = pierTypeSafe === 'exposed'
                const isHiddenPier = pierTypeSafe === 'hidden'
                const isInteriorHiddenPier =
                  (useHiddenNoCutStretcher15x1 || useHiddenStackPier) &&
                  pier.index > 0 &&
                  pier.index < piers.length - 1
                const visiblePierHeight =
                  isHiddenPier || isInteriorHiddenPier ? topRevealMm : pierFace.height
                return (
                  <Group
                    key={`pier-${i}`}
                    opacity={0.95}
                    shadowColor={isExposedPier ? 'rgba(0,0,0,0.35)' : undefined}
                    shadowBlur={isExposedPier ? Math.max(3, 7 * scale) : 0}
                    shadowOffsetX={isExposedPier ? Math.max(1, 5 * scale) : 0}
                    shadowOffsetY={isExposedPier ? Math.max(1, 2 * scale) : 0}
                    clipX={localX}
                    clipY={0}
                    clipWidth={pierFace.width * scale}
                    clipHeight={visiblePierHeight * scale}
                  >
                    <Rect
                      x={localX}
                      y={0}
                      width={pierFace.width * scale}
                      height={visiblePierHeight * scale}
                      fill={MORTAR_FILL}
                      stroke={isExposedPier ? EXPOSED_PIER_EDGE : undefined}
                      strokeWidth={isExposedPier ? Math.max(1.2, 1.1 * scale) : 0}
                    />
                    {isExposedPier && (
                      <>
                        <Rect
                          x={localX}
                          y={0}
                          width={Math.max(1.5, 5 * scale)}
                          height={visiblePierHeight * scale}
                          fill={PIER_SIDE_SHADOW}
                          listening={false}
                        />
                        <Rect
                          x={localX + pierFace.width * scale - Math.max(1.5, 5 * scale)}
                          y={0}
                          width={Math.max(1.5, 5 * scale)}
                          height={visiblePierHeight * scale}
                          fill={PIER_SIDE_SHADOW}
                          listening={false}
                        />
                      </>
                    )}
                    {pierFace.bricks.map((brick, brickIndex) => {
                      if (
                        (isHiddenPier || isInteriorHiddenPier) &&
                        brick.y + brick.h > topRevealMm
                      ) {
                        return null
                      }
                      const w = brick.w * scale
                      const h = brick.h * scale
                      return (
                        <Group key={`pier-brick-${i}-${brickIndex}`}>
                          <Rect
                            x={localX + brick.x * scale}
                            y={brick.y * scale}
                            width={w}
                            height={h}
                            fill={brickFill(brick, brickIndex)}
                            stroke={isExposedPier ? EXPOSED_PIER_EDGE : PIER_STROKE}
                            strokeWidth={isExposedPier ? Math.max(strokePx, 1.1 * scale) : strokePx}
                            cornerRadius={0.5}
                          />
                          {sheenH > 0.5 && (
                            <Rect
                              x={localX + brick.x * scale}
                              y={brick.y * scale}
                              width={w}
                              height={Math.min(sheenH, h)}
                              fill={SHEEN_FILL}
                              listening={false}
                            />
                          )}
                        </Group>
                      )
                    })}
                    {isExposedPier && (
                      <>
                        <Rect
                          x={localX + Math.max(1, 2 * scale)}
                          y={Math.max(1, 2 * scale)}
                          width={Math.max(0, 4 * scale)}
                          height={Math.max(0, visiblePierHeight * scale - 4 * scale)}
                          fill={EXPOSED_PIER_HIGHLIGHT}
                          listening={false}
                        />
                        <Rect
                          x={localX}
                          y={0}
                          width={pierFace.width * scale}
                          height={visiblePierHeight * scale}
                          stroke={EXPOSED_PIER_EDGE}
                          strokeWidth={Math.max(1.4, 1.3 * scale)}
                          listening={false}
                        />
                      </>
                    )}
                  </Group>
                )
              })}

            {clippedSegments.map((segment, i) => (
              <Group
                key={`segment-${i}`}
                clipX={(segment.left - startX) * scale}
                clipY={wallTopY}
                clipWidth={segment.width * scale}
                clipHeight={segment.height * scale}
              >
                <Rect
                  x={(segment.left - startX) * scale}
                  y={wallTopY}
                  width={segment.width * scale}
                  height={segment.height * scale}
                  fill={MORTAR_FILL}
                />
                {segment.bricks
                  .filter((brick) => brick.x + brick.w > startX && brick.x < endX)
                  .map((brick, brickIndex) => {
                  const localX = (brick.x - startX) * scale
                  const localY = wallTopY + brick.y * scale
                  const w = brick.w * scale
                  const h = brick.h * scale
                  return (
                    <Group key={`segment-${i}-brick-${brick.row}-${brick.x}-${brickIndex}`}>
                      <Rect
                        x={localX}
                        y={localY}
                        width={w}
                        height={h}
                        fill={brickFill(brick, brickIndex)}
                        stroke={
                          cutBricksSafe === 'allowed' && brick.type === 'adj'
                            ? STROKE_ADJ
                            : STROKE_NORMAL
                        }
                        strokeWidth={strokePx}
                        cornerRadius={0.5}
                      />
                      {sheenH > 0.5 && (
                        <Rect
                          x={localX}
                          y={localY}
                          width={w}
                          height={Math.min(sheenH, h)}
                          fill={SHEEN_FILL}
                          listening={false}
                        />
                      )}
                    </Group>
                  )
                })}
              </Group>
            ))}

            {timberFenceSafe === 'timber' &&
              clippedRails.map((rail, i) => {
                const x1 = (rail.x1 - startX) * scale
                const x2 = (rail.x2 - startX) * scale
                return (
                  <Group key={`timber-${i}`}>
                    <Line
                      points={[x1, timberTopY, x2, timberTopY]}
                      stroke={TIMBER_STROKE}
                      strokeWidth={Math.max(3, scale * 2.2)}
                      lineCap="round"
                      listening={false}
                    />
                    <Line
                      points={[x1, timberBottomY, x2, timberBottomY]}
                      stroke={TIMBER_STROKE}
                      strokeWidth={Math.max(3, scale * 2.2)}
                      lineCap="round"
                      listening={false}
                    />
                  </Group>
                )
              })}
            {timberFenceSafe === 'pvc' &&
              clippedRails.map((rail, i) => {
                const x1 = (rail.x1 - startX) * scale
                const x2 = (rail.x2 - startX) * scale
                const panelW = Math.max(0, x2 - x1)
                const panelH = Math.max(40 * scale, pvcPanelBottomY - pvcPanelTopY)
                const picketW = Math.max(6, scale * 14)
                const gapW = Math.max(2, scale * 6)
                const stride = picketW + gapW
                const picketCount = Math.max(1, Math.floor((panelW + gapW) / stride))

                return (
                  <Group key={`pvc-${i}`}>
                    <Rect
                      x={x1}
                      y={pvcPanelTopY}
                      width={panelW}
                      height={panelH}
                      fill={PVC_FILL}
                      stroke={PVC_STROKE_SOFT}
                      strokeWidth={Math.max(1, scale * 0.8)}
                      cornerRadius={2}
                    />
                    {Array.from({ length: picketCount }, (_, picketIndex) => {
                      const px = x1 + picketIndex * stride
                      if (px + picketW > x2) return null
                      const tipH = Math.max(5, scale * 16)
                      return (
                        <Group key={`pvc-picket-${i}-${picketIndex}`}>
                          <Rect
                            x={px}
                            y={pvcPanelTopY + tipH}
                            width={picketW}
                            height={Math.max(10, panelH - tipH)}
                            fill="#fffefb"
                            stroke={PVC_STROKE}
                            strokeWidth={Math.max(0.6, scale * 0.5)}
                          />
                          <Line
                            points={[
                              px,
                              pvcPanelTopY + tipH,
                              px + picketW / 2,
                              pvcPanelTopY,
                              px + picketW,
                              pvcPanelTopY + tipH,
                            ]}
                            closed
                            fill="#fffefb"
                            stroke={PVC_STROKE}
                            strokeWidth={Math.max(0.6, scale * 0.5)}
                            listening={false}
                          />
                        </Group>
                      )
                    })}
                  </Group>
                )
              })}
          </Group>
        </Layer>
      </Stage>
      {!wallFitsInView && (
        <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      )}
    </div>
  )
}
