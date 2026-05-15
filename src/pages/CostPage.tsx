import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Stepper from '../components/Stepper'
import WizardLayout from '../components/WizardLayout'
import { useFormContext } from '../context/FormContext'
import { getBond } from '../bonds/registry'
import type { BrickData } from '../bonds/types'
import {
  DEFAULT_BRICK_DIMENSIONS,
  brickDimensionsFromStrings,
  validateBrickDimensions,
  type BrickDimensions,
} from '../bonds/brickDimensions'

const PIER_EXTRA_HEIGHT_MM = 180
const MAX_PIER_SPACING_MM = 3000

interface PierSpec {
  frontWidth: number
  depth: number
}

interface PierLayout {
  center: number
  left: number
  width: number
}

interface WallSegment {
  left: number
  width: number
  height: number
  bricks: BrickData[]
}

interface SnappedBond {
  wallW: number
  wallH: number
  bricks: BrickData[]
}

interface SavedQuote {
  id: string
  name: string
  date: string
  length: string
  height: string
  bondPattern: string
  pierType: string
  pierSize: string
  pierHeight: string
  pierSpacing: string
  cutBricks: string
  timberFence: string
  brickSizeMode?: string
  brickLength?: string
  brickWidth?: string
  brickHeight?: string
  mortarJoint?: string
  brickCount: number
  mortarVolumeM3: number
}

function buildPierSpecs(dimensions: BrickDimensions): Record<string, PierSpec> {
  const { length: brickL, width: brickW, mortar } = dimensions

  return {
    '1_5x1': {
      frontWidth: brickL + mortar + brickW,
      depth: brickL,
    },
    '1_5x1_5': {
      frontWidth: brickL + mortar + brickW,
      depth: brickL + mortar + brickW,
    },
    '2x1': {
      frontWidth: brickL + mortar + brickL,
      depth: brickL,
    },
    '2x2': {
      frontWidth: brickL + mortar + brickL,
      depth: brickL + mortar + brickL,
    },
  }
}

function buildNoCutSearchOffsets(limit: number, mortar: number): number[] {
  const offsets = [0]
  for (let step = mortar; step <= limit; step += mortar) {
    offsets.push(step, -step)
  }
  return offsets
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

function tryGenerateNoCutBond(
  bond: NonNullable<ReturnType<typeof getBond>>,
  targetWallL: number,
  wallH: number,
  dimensions: BrickDimensions,
): SnappedBond | null {
  if (targetWallL <= 0 || wallH <= 0) return null

  for (const offset of buildNoCutSearchOffsets(1600, dimensions.mortar)) {
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

function cutReferenceDimension(
  brick: BrickData,
  bondPattern: string,
  dimensions: BrickDimensions,
): number {
  if (bondPattern === 'header') return dimensions.width
  if (bondPattern === 'english') return brick.row % 2 === 1 ? dimensions.width : dimensions.length
  if (bondPattern === 'englishGarden') {
    return brick.row % 4 === 0 ? dimensions.width : dimensions.length
  }
  if (bondPattern === 'flemish' || bondPattern === 'flemishGarden') {
    return brick.w <= dimensions.width ? dimensions.width : dimensions.length
  }
  return dimensions.length
}

function brickFaceType(
  brick: BrickData,
  bondPattern: string,
  dimensions: BrickDimensions,
): 'stretcher' | 'header' {
  if (bondPattern === 'header') return 'header'
  if (bondPattern === 'english') return brick.row % 2 === 1 ? 'header' : 'stretcher'
  if (bondPattern === 'englishGarden') {
    return brick.row % 4 === 0 ? 'header' : 'stretcher'
  }
  if (bondPattern === 'flemish' || bondPattern === 'flemishGarden') {
    return brick.w <= dimensions.width ? 'header' : 'stretcher'
  }
  return 'stretcher'
}

function withoutPierWallBrickCount(
  wallSegments: WallSegment[],
  dimensions: BrickDimensions,
  bondPattern: string,
): number {
  let stretcherCount = 0
  let headerCount = 0
  let stretcherCutCount = 0
  let headerCutCount = 0

  for (const segment of wallSegments) {
    for (const brick of segment.bricks) {
      const faceType = brickFaceType(brick, bondPattern, dimensions)

      if (brick.type === 'adj') {
        const reference = cutReferenceDimension(brick, bondPattern, dimensions)
        const cutCount = brick.w / reference <= 0.5 ? 0.5 : 1

        if (faceType === 'stretcher') {
          stretcherCutCount += cutCount
        } else {
          headerCutCount += cutCount
        }
      } else if (faceType === 'stretcher') {
        stretcherCount += 1
      } else {
        headerCount += 1
      }
    }
  }

  const fullBrickCount = stretcherCount * 2 + headerCount
  const cutBrickCount = Math.ceil(stretcherCutCount * 2 + headerCutCount)
  return fullBrickCount + cutBrickCount
}

function withoutPierWallBrickVolumeMm3(
  wallSegments: WallSegment[],
  dimensions: BrickDimensions,
  bondPattern: string,
): number {
  const fullBrickVolume = dimensions.length * dimensions.width * dimensions.height
  let brickVolume = 0

  for (const segment of wallSegments) {
    for (const brick of segment.bricks) {
      const faceType = brickFaceType(brick, bondPattern, dimensions)
      const faceMultiplier = faceType === 'stretcher' ? 2 : 1

      if (brick.type === 'adj') {
        const reference = cutReferenceDimension(brick, bondPattern, dimensions)
        const cutRatio = Math.max(0, Math.min(1, brick.w / reference))
        brickVolume += fullBrickVolume * cutRatio * faceMultiplier
      } else {
        brickVolume += fullBrickVolume * faceMultiplier
      }
    }
  }

  return brickVolume
}

function computeMetrics(params: {
  lengthM: number
  heightM: number
  bondPattern: string
  pierType: string
  pierSize: string
  pierHeightM: number
  pierSpacingM: number
  cutBricks: string
  brickDimensions: BrickDimensions
}): {
  brickCount: number
  mortarVolumeM3: number
  renderedLengthM: number
  renderedHeightM: number
} {
  const wallL = params.lengthM * 1000
  const wallHmm = params.heightM * 1000
  const bond = getBond(params.bondPattern) ?? getBond('stretcher')
  const dimensions = params.brickDimensions
  if (!bond || wallL <= 0 || wallHmm <= 0) {
    return {
      brickCount: 0,
      mortarVolumeM3: 0,
      renderedLengthM: 0,
      renderedHeightM: 0,
    }
  }

  const pierTypeSafe = params.pierType || 'none'
  const requestedPierSize = params.pierSize || '1_5x1_5'
  const pierSizeSafe =
    params.bondPattern === 'stack' &&
    pierTypeSafe === 'hidden' &&
    requestedPierSize !== '2x1' &&
    requestedPierSize !== '2x2'
      ? '2x1'
      : (params.bondPattern === 'stack' ||
          params.bondPattern === 'stretcher') &&
        pierTypeSafe === 'exposed' &&
        requestedPierSize !== '2x2'
      ? '2x2'
      : requestedPierSize
  const cutBricksSafe = params.cutBricks || 'allowed'
  const pierSpecs = buildPierSpecs(dimensions)
  const pierSpec = pierSpecs[pierSizeSafe] ?? pierSpecs['1_5x1_5']
  const requestedPierHeightMm =
    params.pierHeightM > 0 ? params.pierHeightM * 1000 : wallHmm + PIER_EXTRA_HEIGHT_MM
  const effectivePierType = pierTypeSafe !== 'none' && requestedPierHeightMm > wallHmm
    ? pierTypeSafe
    : 'none'
  const pierHeightMm = effectivePierType === 'none' ? wallHmm : requestedPierHeightMm
  const desiredSpacingMm = Math.max(
    dimensions.length + dimensions.mortar,
    Math.min(MAX_PIER_SPACING_MM, params.pierSpacingM * 1000 || 2800),
  )
  const snappedRequestedSpacingMm = Math.max(
    dimensions.length + dimensions.mortar,
    Math.round(desiredSpacingMm / (dimensions.length + dimensions.mortar)) *
      (dimensions.length + dimensions.mortar),
  )
  const useHiddenNoCutStretcher15x1 =
    effectivePierType === 'hidden' &&
    cutBricksSafe === 'notAllowed' &&
    params.bondPattern === 'stretcher' &&
    pierSizeSafe === '1_5x1'

  let renderedH = wallHmm
  let wallSegments: WallSegment[] = []
  let piers: PierLayout[] = []

  if (effectivePierType === 'none') {
    const result =
      cutBricksSafe === 'notAllowed'
        ? tryGenerateNoCutBond(bond, wallL, wallHmm, dimensions) ??
          bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
        : bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
    renderedH = result.wallH
    wallSegments = [{
      left: 0,
      width: result.wallW,
      height: result.wallH,
      bricks: result.bricks,
    }]
  } else {
    const interiorSpan = Math.max(0, wallL - pierSpec.frontWidth)
    const bayCount = Math.max(1, Math.ceil(interiorSpan / snappedRequestedSpacingMm))

    if (params.bondPattern === 'stack') {
      const bondResult = bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
      renderedH = bondResult.wallH
      piers = buildStackAlignedPierLayouts(
        bondResult.wallW,
        pierSpec.frontWidth,
        bayCount,
        dimensions.length + dimensions.mortar,
      )

      for (let i = 0; i < piers.length - 1; i++) {
        const current = piers[i]
        const next = piers[i + 1]
        const left = current.left + current.width
        const right = next.left
        const width = Math.max(0, right - left)
        if (width <= 0) continue

        const bricks = bondResult.bricks.flatMap((brick) => {
          const visibleLeft = Math.max(brick.x, left)
          const visibleRight = Math.min(brick.x + brick.w, right)
          const visibleWidth = visibleRight - visibleLeft
          if (visibleWidth <= 0) return []

          const clipped = visibleWidth !== brick.w || visibleLeft !== brick.x
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
          height: bondResult.wallH,
          bricks,
        })
      }
    } else if (useHiddenNoCutStretcher15x1) {
      const wallInset = dimensions.width + dimensions.mortar
      const snappedWall =
        tryGenerateNoCutBond(
          bond,
          Math.max(dimensions.length, wallL - wallInset * 2),
          wallHmm,
          dimensions,
        ) ??
        bond.generate({
          wallL: Math.max(dimensions.length, wallL - wallInset * 2),
          wallH: wallHmm,
          brickDimensions: dimensions,
        })
      const renderedW = snappedWall.wallW + wallInset * 2
      piers = Array.from({ length: bayCount + 1 }, (_, idx) => {
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
      renderedH = snappedWall.wallH
      wallSegments = [{
        left: wallInset,
        width: snappedWall.wallW,
        height: snappedWall.wallH,
        bricks: snappedWall.bricks.map((brick) => ({
          ...brick,
          x: brick.x + wallInset,
        })),
      }]
    } else if (cutBricksSafe === 'notAllowed') {
      const snappedBay = tryGenerateNoCutBond(
        bond,
        Math.max(dimensions.width, snappedRequestedSpacingMm - pierSpec.frontWidth),
        wallHmm,
        dimensions,
      )

      if (snappedBay) {
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
              height: snappedBay.wallH,
              bricks: snappedBay.bricks.map((brick) => ({
                ...brick,
                x: brick.x + cursor,
              })),
            })
            cursor += snappedBay.wallW
          }
        }
        renderedH = snappedBay.wallH
      }
    } else {
      const bondResult = bond.generate({ wallL, wallH: wallHmm, brickDimensions: dimensions })
      renderedH = bondResult.wallH
      piers = Array.from({ length: bayCount + 1 }, (_, idx) => {
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

      for (let i = 0; i < piers.length - 1; i++) {
        const current = piers[i]
        const next = piers[i + 1]
        const left = current.left + current.width
        const right = next.left
        const width = Math.max(0, right - left)
        if (width <= 0) continue

        const bricks = bondResult.bricks.flatMap((brick) => {
          const visibleLeft = Math.max(brick.x, left)
          const visibleRight = Math.min(brick.x + brick.w, right)
          const visibleWidth = visibleRight - visibleLeft
          if (visibleWidth <= 0) return []
          return [{
            ...brick,
            x: visibleLeft,
            w: visibleWidth,
            type:
              visibleWidth !== brick.w || visibleLeft !== brick.x ? 'adj' : brick.type,
          }]
        })

        wallSegments.push({
          left,
          width,
          height: bondResult.wallH,
          bricks,
        })
      }
    }
  }

  const wallBrickCount = withoutPierWallBrickCount(
    wallSegments,
    dimensions,
    params.bondPattern,
  )
  const wallBrickVolume = withoutPierWallBrickVolumeMm3(
    wallSegments,
    dimensions,
    params.bondPattern,
  )
  const wallGrossVolume = wallSegments.reduce(
    (sum, segment) =>
      sum + segment.width * segment.height * dimensions.length,
    0,
  )

  const courseH = dimensions.height + dimensions.mortar
  const nPierRows = Math.max(1, Math.ceil((pierHeightMm + dimensions.mortar) / courseH))
  const wallRows = Math.max(1, Math.ceil((renderedH + dimensions.mortar) / courseH))

  const pierBrickCount = piers.reduce((sum, _, index) => {
    if (effectivePierType === 'hidden' && useHiddenNoCutStretcher15x1 && index > 0 && index < piers.length - 1) {
      return sum + Math.max(0, nPierRows - wallRows) * 1.5
    }
    const bricksPerRow =
      pierSizeSafe === '2x1' || pierSizeSafe === '2x2'
        ? 2.5
        : 1.5
    return sum + nPierRows * bricksPerRow
  }, 0)

  const pierBrickVolume = piers.reduce((sum, _, index) => {
    if (effectivePierType === 'hidden' && useHiddenNoCutStretcher15x1 && index > 0 && index < piers.length - 1) {
      return sum + Math.max(0, nPierRows - wallRows) *
        (dimensions.length + dimensions.width) *
        dimensions.height *
        dimensions.width
    }
    const gross = pierSpec.frontWidth * pierHeightMm * dimensions.width
    const fillRatio =
      pierSizeSafe === '2x1' || pierSizeSafe === '2x2'
        ? 0.78
        : 0.72
    return sum + gross * fillRatio
  }, 0)

  const pierGrossVolume = piers.reduce(
    (sum) => sum + pierSpec.frontWidth * pierSpec.depth * pierHeightMm,
    0,
  )

  const totalBrickCount = Math.ceil(wallBrickCount + pierBrickCount)
  const totalBrickVolume = wallBrickVolume + pierBrickVolume
  const totalGrossVolume = wallGrossVolume + pierGrossVolume
  const mortarVolumeM3 = Math.max(0, (totalGrossVolume - totalBrickVolume) / 1_000_000_000)
  const renderedLengthExtents = [
    ...wallSegments.map((segment) => segment.left + segment.width),
    ...piers.map((pier) => pier.left + pier.width),
  ]
  const renderedLengthMm =
    renderedLengthExtents.length > 0
      ? Math.max(...renderedLengthExtents)
      : wallL

  return {
    brickCount: totalBrickCount,
    mortarVolumeM3,
    renderedLengthM: renderedLengthMm / 1000,
    renderedHeightM: renderedH / 1000,
  }
}

function upsertQuote(quote: SavedQuote) {
  try {
    const existing: SavedQuote[] = JSON.parse(
      localStorage.getItem('fence-calculator-quotes') || '[]',
    )
    const idx = existing.findIndex(
      (q) => q.name.toLowerCase() === quote.name.toLowerCase(),
    )
    if (idx !== -1) {
      existing[idx] = { ...quote, id: existing[idx].id }
    } else {
      existing.push(quote)
    }
    localStorage.setItem('fence-calculator-quotes', JSON.stringify(existing))
  } catch {
    // ignore
  }
}

function formatMeters(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function createSavedQuote(params: {
  name: string
  state: ReturnType<typeof useFormContext>['state']
  effectivePierSize: string
  brickCount: number
  mortarVolumeM3: number
}): SavedQuote {
  return {
    id: Date.now().toString(),
    name: params.name,
    date: new Date().toLocaleDateString(),
    length: params.state.length,
    height: params.state.height,
    bondPattern: params.state.bondPattern,
    pierType: params.state.pierType,
    pierSize: params.effectivePierSize,
    pierHeight: params.state.pierHeight,
    pierSpacing: params.state.pierSpacing,
    cutBricks: params.state.cutBricks,
    timberFence: params.state.timberFence,
    brickSizeMode: params.state.brickSizeMode,
    brickLength: params.state.brickLength,
    brickWidth: params.state.brickWidth,
    brickHeight: params.state.brickHeight,
    mortarJoint: params.state.mortarJoint,
    brickCount: params.brickCount,
    mortarVolumeM3: params.mortarVolumeM3,
  }
}

export default function CostPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { state, dispatch } = useFormContext()
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [quoteName, setQuoteName] = useState('')
  const [savedMessage, setSavedMessage] = useState(false)

  const length = parseFloat(state.length) || 0
  const height = parseFloat(state.height) || 0
  const pierHeight = parseFloat(state.pierHeight) || 0
  const brickDimensions = brickDimensionsFromStrings(state)
  const brickDimensionsValid = validateBrickDimensions(brickDimensions)
  const effectivePierSize =
    state.bondPattern === 'stack' &&
    state.pierType === 'hidden' &&
    state.pierSize !== '2x1' &&
    state.pierSize !== '2x2'
      ? '2x1'
      : (state.bondPattern === 'stack' ||
          state.bondPattern === 'stretcher') &&
        state.pierType === 'exposed' &&
        state.pierSize !== '2x2'
      ? '2x2'
      : state.pierSize
  const metrics = computeMetrics({
    lengthM: length,
    heightM: height,
    bondPattern: state.bondPattern,
    pierType: state.pierType,
    pierSize: effectivePierSize,
    pierHeightM: pierHeight,
    pierSpacingM: parseFloat(state.pierSpacing) || 0,
    cutBricks: state.cutBricks,
    brickDimensions: brickDimensionsValid ? brickDimensions : DEFAULT_BRICK_DIMENSIONS,
  })
  const metersLabel = t('cost.meters')
  const renderedLengthLabel = `${formatMeters(metrics.renderedLengthM)} ${metersLabel} (${formatMeters(length)} ${metersLabel})`
  const renderedHeightLabel = `${formatMeters(metrics.renderedHeightM)} ${metersLabel} (${formatMeters(height)} ${metersLabel})`

  const openSaveDialog = () => {
    setQuoteName(state.activeQuoteName ?? '')
    setShowSaveDialog(true)
  }

  const handleSave = () => {
    if (!quoteName.trim()) return
    const name = quoteName.trim()
    const quote = createSavedQuote({
      name,
      state,
      effectivePierSize,
      brickCount: metrics.brickCount,
      mortarVolumeM3: metrics.mortarVolumeM3,
    })
    upsertQuote(quote)
    dispatch({ type: 'SET_FIELD', field: 'activeQuoteName', value: name })
    setShowSaveDialog(false)
    setQuoteName('')
    setSavedMessage(true)
    setTimeout(() => setSavedMessage(false), 2000)
  }

  const handleStartOver = () => {
    dispatch({ type: 'RESET' })
    navigate('/')
  }

  const missingData = !length || !height || !state.bondPattern || !brickDimensionsValid

  useEffect(() => {
    if (missingData) navigate('/dimensions', { replace: true })
  }, [missingData, navigate])

  if (missingData) return null

  const form = (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
      <h1 className="text-2xl font-bold text-text mb-2">{t('cost.heading')}</h1>
      <p className="text-text-muted mb-6">{t('cost.description')}</p>

      <div className="bg-surface-alt rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-text">{t('cost.breakdown')}</h2>
        </div>
        <div className="divide-y divide-border">
          <Row label={t('cost.fenceLength')} value={renderedLengthLabel} />
          <Row label={t('cost.fenceHeight')} value={renderedHeightLabel} />
          <Row
            label={t('cost.brickSize')}
            value={
              state.brickSizeMode === 'custom'
                ? `${t('dimensions.customBrick')}: ${brickDimensions.length} x ${brickDimensions.width} x ${brickDimensions.height} mm / ${brickDimensions.mortar} mm`
                : `${t('dimensions.standardBrick')}: ${brickDimensions.length} x ${brickDimensions.width} x ${brickDimensions.height} mm / ${brickDimensions.mortar} mm`
            }
          />
          <Row label={t('cost.bondPattern')} value={t(`bond.${state.bondPattern}`)} />
          <Row label={t('cost.cutBricks')} value={t(`cutBricks.options.${state.cutBricks}`)} />
          <Row label={t('cost.pierType')} value={t(`pier.types.${state.pierType}`)} />
          {state.pierType !== 'none' && (
            <Row label={t('cost.pierSize')} value={t(`pier.sizes.${effectivePierSize}`)} />
          )}
          {state.pierType !== 'none' && (
            <Row label={t('cost.pierHeight')} value={`${state.pierHeight} ${t('cost.meters')}`} />
          )}
          {state.pierType !== 'none' && (
            <Row
              label={t('cost.pierSpacing')}
              value={`${state.pierSpacing} ${t('cost.meters')}`}
            />
          )}
          {state.pierType !== 'none' && (
            <Row
              label={t('cost.timberFence')}
              value={t(`pier.timberFenceOptions.${state.timberFence}`)}
            />
          )}
          <Row label={t('cost.brickCount')} value={metrics.brickCount.toString()} />
          <Row
            label={t('cost.mortarVolume')}
            value={`${metrics.mortarVolumeM3.toFixed(3)} ${t('cost.cubicMeters')}`}
          />
          <div className="flex justify-between px-6 py-4 bg-primary/5">
            <span className="font-bold text-text">{t('cost.summary')}</span>
            <span className="font-bold text-primary text-lg">
              {metrics.brickCount} / {metrics.mortarVolumeM3.toFixed(3)} {t('cost.cubicMeters')}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-muted mt-4 leading-relaxed">{t('cost.disclaimer')}</p>

      {savedMessage && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium text-center">
          {t('quotes.saved')}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <button
          onClick={() => navigate('/bond')}
          className="inline-flex items-center justify-center gap-2 text-text-muted hover:text-text font-medium py-3 px-6 rounded-xl transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          {t('common.back')}
        </button>
        <button
          onClick={openSaveDialog}
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm flex-1 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          {t('cost.saveQuote')}
        </button>
        <button
          onClick={handleStartOver}
          className="inline-flex items-center justify-center gap-2 border border-border hover:bg-gray-50 text-text font-medium py-3 px-6 rounded-xl transition-colors cursor-pointer"
        >
          {t('cost.startOver')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col items-center">
      <Stepper currentStep={3} />
      <WizardLayout
        form={form}
        lengthM={length}
        heightM={height}
        bondPattern={state.bondPattern}
        pierType={state.pierType}
        pierSize={effectivePierSize}
        pierHeightM={pierHeight}
        pierSpacingM={parseFloat(state.pierSpacing) || 0}
        cutBricks={state.cutBricks}
        timberFence={state.timberFence}
        brickDimensions={brickDimensions}
        showDiagram={length > 0 && height > 0}
      />

      {showSaveDialog && (
        <SaveDialog
          quoteName={quoteName}
          onNameChange={setQuoteName}
          onSave={handleSave}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-6 py-3">
      <span className="text-text-muted">{label}</span>
      <span className="text-text font-medium">{value}</span>
    </div>
  )
}

function nameExistsInStorage(name: string): boolean {
  try {
    const quotes: SavedQuote[] = JSON.parse(
      localStorage.getItem('fence-calculator-quotes') || '[]',
    )
    return quotes.some((q) => q.name.toLowerCase() === name.trim().toLowerCase())
  } catch {
    return false
  }
}

function SaveDialog({
  quoteName,
  onNameChange,
  onSave,
  onCancel,
}: {
  quoteName: string
  onNameChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const nameValue = quoteName ?? ''
  const willOverwrite = nameValue.trim() !== '' && nameExistsInStorage(nameValue)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-text mb-4">{t('quotes.namePrompt')}</h3>
        <input
          type="text"
          value={quoteName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('quotes.namePlaceholder')}
          className="w-full px-4 py-3 rounded-xl border border-border bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-text"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
        />
        {willOverwrite && (
          <p className="mt-2 text-xs text-amber-600">{t('quotes.willOverwrite')}</p>
        )}
        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-border text-text-muted font-medium hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {t('quotes.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={!quoteName.trim()}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark disabled:bg-gray-300 text-white font-semibold transition-colors cursor-pointer"
          >
            {t('quotes.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
