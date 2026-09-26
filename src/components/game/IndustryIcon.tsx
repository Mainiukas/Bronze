import { useState, type ImgHTMLAttributes } from 'react'
import { INDUSTRY_ICON_URLS } from '../board/assets'
import { INDUSTRY_SHORT } from '../../data/board'
import { INDUSTRIES } from '../../game/rules'
import type { IndustryKind } from '../../game/types'

interface IndustryIconProps extends ImgHTMLAttributes<HTMLImageElement> {
  kind: IndustryKind
}

/**
 * The industry's picture (assets/icons), sized by font-size unless a class
 * sets it. If the image is missing it shows a short label instead.
 */
export function IndustryIcon({ kind, className = '', style, ...props }: IndustryIconProps) {
  const url = INDUSTRY_ICON_URLS[kind]
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <span
        aria-hidden="true"
        className={`inline-grid place-items-center rounded-sm bg-soot-800 font-board leading-none font-bold text-parchment-200 ${className}`}
        style={{ width: '1em', height: '1em', fontSize: 'inherit', ...style }}
      >
        <span style={{ fontSize: '0.32em' }}>{INDUSTRY_SHORT[kind]}</span>
      </span>
    )
  }
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`inline-block object-contain ${className}`}
      style={{ width: '1em', height: '1em', ...style }}
      onError={() => {
        console.warn(`Icon for ${INDUSTRIES[kind].name} failed to load; showing a short label instead.`)
        setFailed(true)
      }}
      {...props}
    />
  )
}
