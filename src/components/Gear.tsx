import { useMemo, type SVGProps } from 'react'

interface GearProps extends SVGProps<SVGSVGElement> {
  /** Number of teeth. */
  teeth?: number
  /** Number of round cut-outs between hub and rim (0 for a solid gear). */
  holes?: number
}

/** Point on a circle of radius r at angle a, as "x y". */
function point(angle: number, radius: number): string {
  return `${(Math.cos(angle) * radius).toFixed(2)} ${(Math.sin(angle) * radius).toFixed(2)}`
}

/** A full circle as a closed sub-path, for cut-outs (with fill-rule evenodd). */
function circle(cx: number, cy: number, r: number): string {
  return `M${(cx + r).toFixed(2)} ${cy.toFixed(2)} a${r} ${r} 0 1 0 ${-2 * r} 0 a${r} ${r} 0 1 0 ${2 * r} 0Z`
}

/** Build the SVG path for a gear centred on 0,0 with an outer radius of 100. */
function gearPath(teeth: number, holes: number): string {
  const outer = 100
  const root = 84
  const step = (Math.PI * 2) / teeth
  let d = ''

  // Rim: for each tooth rise to the tip, cross it, fall back, then follow
  // the root circle to where the next tooth starts.
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    d += `${i === 0 ? 'M' : 'L'}${point(a, root)} `
    d += `L${point(a + step * 0.12, outer)} L${point(a + step * 0.4, outer)} `
    d += `L${point(a + step * 0.52, root)} `
    d += `A${root} ${root} 0 0 1 ${point(a + step, root)} `
  }
  d += 'Z '

  // Axle hole and lightening holes.
  d += circle(0, 0, 18)
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2 + Math.PI / holes
    d += circle(Math.cos(a) * 52, Math.sin(a) * 52, 17)
  }
  return d
}

/** Decorative gear, filled with currentColor. */
export function Gear({ teeth = 12, holes = 5, ...props }: GearProps) {
  const d = useMemo(() => gearPath(teeth, holes), [teeth, holes])
  return (
    <svg viewBox="-100 -100 200 200" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d={d} fillRule="evenodd" />
    </svg>
  )
}
