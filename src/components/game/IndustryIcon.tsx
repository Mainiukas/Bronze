import type { SVGProps } from 'react'
import type { IndustryKind } from '../../game/types'
import { INDUSTRY_GLYPHS } from './glyphs'

interface IndustryIconProps extends SVGProps<SVGSVGElement> {
  kind: IndustryKind
}

/** Industry glyph for use in HTML (sized by font-size, colored by currentColor). */
export function IndustryIcon({ kind, ...props }: IndustryIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={INDUSTRY_GLYPHS[kind]} />
    </svg>
  )
}
