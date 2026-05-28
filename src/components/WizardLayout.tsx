import type { ReactNode } from 'react'
import type { BrickDimensions } from '../bonds/brickDimensions'

interface WizardLayoutProps {
  form: ReactNode
  lengthM: number
  heightM: number
  bondPattern?: string
  pierType?: string
  pierSize?: string
  pierHeightM?: number
  pierSpacingM?: number
  cutBricks?: string
  timberFence?: string
  timberFenceStyle?: string
  brickDimensions?: BrickDimensions
  showDiagram: boolean
}

export default function WizardLayout({
  form,
  lengthM,
  heightM,
  bondPattern,
  pierType,
  pierSize,
  pierHeightM,
  pierSpacingM,
  cutBricks,
  timberFence,
  timberFenceStyle,
  brickDimensions,
  showDiagram,
}: WizardLayoutProps) {
  void lengthM
  void heightM
  void bondPattern
  void pierType
  void pierSize
  void pierHeightM
  void pierSpacingM
  void cutBricks
  void timberFence
  void timberFenceStyle
  void brickDimensions
  void showDiagram

  return (
    <div className="w-full">
      {form}
    </div>
  )
}
