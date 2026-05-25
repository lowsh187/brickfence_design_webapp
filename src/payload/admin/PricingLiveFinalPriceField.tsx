'use client'

import { useEffect, useMemo, useState } from 'react'
import { useField, useFormFields } from '@payloadcms/ui'

type SupplierSource = {
  id?: number | string
  supplierName?: string | null
  lastPrice?: number | null
  lastPriceDisplay?: string | null
  lastStatus?: string | null
  unit?: string | null
  unitQuantity?: number | null
  customUnit?: string | null
}

function formatPricingUnit(unit: string | null | undefined): string {
  switch (unit) {
    case 'each':
      return 'each'
    case 'per_1000':
      return 'per 1000'
    case 'per_quantity':
      return 'per quantity'
    case 'per_brick':
      return 'per brick'
    case 'm3':
      return 'per cubic metre'
    case 'm2':
      return 'per square metre'
    case 'm':
      return 'per metre'
    case '20kg_bag':
      return 'per 20kg bag'
    case 'per_bag':
      return 'per bag'
    case 'custom':
      return 'custom unit'
    default:
      return unit || ''
  }
}

function formatPriceWithUnit(
  price: unknown,
  unit: string | null | undefined,
  unitQuantity?: unknown,
): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) return ''
  const unitLabel =
    unit === 'per_quantity' &&
    typeof unitQuantity === 'number' &&
    Number.isFinite(unitQuantity) &&
    unitQuantity > 0
      ? `per ${unitQuantity}`
      : formatPricingUnit(unit)

  return `${price} ${unitLabel}`.trim()
}

function getRelationshipID(
  value: number | string | { id?: number | string } | null | undefined,
): number | string | undefined {
  if (typeof value === 'number' || typeof value === 'string') return value
  return value?.id
}

export function PricingLiveFinalPriceField() {
  const { setValue } = useField<string>({ path: 'finalPriceDisplay' })
  const { setValue: setSourceDisplay } = useField<string>({
    path: 'finalPriceSourceDisplay',
  })
  const { setValue: setSelectedSupplierDisplay } = useField<string>({
    path: 'selectedSupplierUnitPriceDisplay',
  })
  const [supplierSource, setSupplierSource] = useState<SupplierSource | null>(null)

  const formValues = useFormFields(([fields]) => ({
    autoAverageUnitPrice: fields.autoAverageUnitPrice?.value,
    customUnit: fields.customUnit?.value,
    manualUnitPrice: fields.manualUnitPrice?.value,
    priceSource: fields.priceSource?.value,
    selectedSupplierPriceSource: fields.selectedSupplierPriceSource?.value,
    unit: fields.unit?.value,
    unitQuantity: fields.unitQuantity?.value,
  }))

  const selectedSupplierID = getRelationshipID(
    formValues.selectedSupplierPriceSource as
      | number
      | string
      | { id?: number | string }
      | null
      | undefined,
  )

  useEffect(() => {
    if (formValues.priceSource !== 'supplier' || !selectedSupplierID) {
      setSupplierSource(null)
      return
    }

    let isActive = true

    async function loadSupplierSource() {
      try {
        const response = await fetch(
          `/api/supplier-price-sources/${selectedSupplierID}?depth=0`,
        )

        if (!response.ok) throw new Error('Unable to load supplier source')

        const data = (await response.json()) as SupplierSource
        if (isActive) setSupplierSource(data)
      } catch {
        if (isActive) setSupplierSource(null)
      }
    }

    void loadSupplierSource()

    return () => {
      isActive = false
    }
  }, [formValues.priceSource, selectedSupplierID])

  const display = useMemo(() => {
    const unit =
      formValues.unit === 'custom'
        ? formValues.customUnit as string | null | undefined
        : formValues.unit as string | null | undefined
    const averageDisplay = formatPriceWithUnit(
      formValues.autoAverageUnitPrice,
      unit,
      formValues.unitQuantity,
    )
    const manualDisplay = formatPriceWithUnit(
      formValues.manualUnitPrice,
      unit,
      formValues.unitQuantity,
    )
    const supplierDisplay =
      supplierSource?.lastPriceDisplay ||
      formatPriceWithUnit(supplierSource?.lastPrice, supplierSource?.unit)

    if (formValues.priceSource === 'supplier') {
      return supplierDisplay || averageDisplay || 'No data'
    }

    if (formValues.priceSource === 'average') {
      return averageDisplay || 'No data'
    }

    return manualDisplay || averageDisplay || 'No data'
  }, [
    formValues.autoAverageUnitPrice,
    formValues.customUnit,
    formValues.manualUnitPrice,
    formValues.priceSource,
    formValues.unit,
    formValues.unitQuantity,
    supplierSource?.lastPrice,
    supplierSource?.lastPriceDisplay,
    supplierSource?.unit,
  ])

  const sourceDisplay = useMemo(() => {
    if (formValues.priceSource === 'supplier') {
      return supplierSource?.supplierName || 'Specific supplier price'
    }

    if (formValues.priceSource === 'average') return 'Supplier average price'
    if (formValues.priceSource === 'manual') return 'Manual price'
    return 'No data'
  }, [formValues.priceSource, supplierSource?.supplierName])

  const selectedSupplierDisplay =
    supplierSource?.lastPriceDisplay ||
    formatPriceWithUnit(
      supplierSource?.lastPrice,
      supplierSource?.unit === 'custom'
        ? supplierSource?.customUnit
        : supplierSource?.unit,
      supplierSource?.unitQuantity,
    )

  useEffect(() => {
    setValue(display, true)
    setSourceDisplay(sourceDisplay, true)
    setSelectedSupplierDisplay(
      formValues.priceSource === 'supplier' ? selectedSupplierDisplay : '',
      true,
    )
  }, [
    display,
    formValues.priceSource,
    selectedSupplierDisplay,
    setSelectedSupplierDisplay,
    setSourceDisplay,
    setValue,
    sourceDisplay,
  ])

  return (
    <div style={{ marginBottom: 24 }}>
      <label
        style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 500,
          marginBottom: 8,
        }}
      >
        Final Price Display
      </label>
      <div
        style={{
          background: '#f1f1f1',
          border: '1px solid #d6d6d6',
          borderRadius: 3,
          color: display === 'No data' ? '#777' : '#222',
          minHeight: 42,
          padding: '11px 12px',
        }}
      >
        {display}
      </div>
      <p style={{ color: '#777', fontSize: 13, marginTop: 8 }}>
        Updates immediately from the selected price source. Save to persist it.
      </p>
    </div>
  )
}
