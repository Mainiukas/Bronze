import type { ReactNode, SVGProps } from 'react'

/**
 * Line icons drawn for Bronze. All use currentColor, so they pick up the
 * surrounding text color, and are hidden from screen readers by default
 * (the button or label next to them carries the accessible name).
 */

export type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
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
      {children}
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
  )
}

export function IconArrowLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  )
}

export function IconMap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </Svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  )
}

export function IconUsers(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M16.6 14c2.5.3 4.4 2.3 4.4 5" />
    </Svg>
  )
}

export function IconCog(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.3 3h3.4l.6 2.4 1.9.8 2.1-1.3 2.4 2.4-1.3 2.1.8 1.9 2.4.6v3.4l-2.4.6-.8 1.9 1.3 2.1-2.4 2.4-2.1-1.3-1.9.8-.6 2.4h-3.4l-.6-2.4-1.9-.8-2.1 1.3-2.4-2.4 1.3-2.1-.8-1.9L2.8 13.7v-3.4l2.4-.6.8-1.9-1.3-2.1 2.4-2.4 2.1 1.3 1.9-.8z" />
      <circle cx="12" cy="12" r="3.2" />
    </Svg>
  )
}

export function IconBook(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 6.5C10.5 5 8.2 4.5 4 4.5v13.5c4.2 0 6.5.5 8 2 1.5-1.5 3.8-2 8-2V4.5c-4.2 0-6.5.5-8 2zM12 6.5V20" />
    </Svg>
  )
}

export function IconStar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8L8 13.5l-4.3-4 5.8-.7z" />
    </Svg>
  )
}

export function IconPlay(props: IconProps) {
  return (
    <Svg fill="currentColor" stroke="none" {...props}>
      <path d="M8 5.2v13.6a.8.8 0 001.2.7l10.6-6.8a.8.8 0 000-1.4L9.2 4.5A.8.8 0 008 5.2z" />
    </Svg>
  )
}

/* ---- Game mode icons ---------------------------------------------------- */

export function IconFactory(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 20.5h18V3.5h-3.5v9L13 9.5v3L8 9.5v3L3 9.5z" />
      <path d="M6.5 16.5h2M11 16.5h2M15.5 16.5h2" />
    </Svg>
  )
}

export function IconBolt(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z" />
    </Svg>
  )
}

export function IconStopwatch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6M18.3 6.8l1.5-1.5" />
    </Svg>
  )
}

/* ---- Tab icons ---------------------------------------------------------- */

export function IconTopHat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 17V6.5C7 5.1 9.2 4 12 4s5 1.1 5 2.5V17" />
      <path d="M7 13.5c1.4.6 3.1 1 5 1s3.6-.4 5-1" />
      <path d="M3 17.5c2 1.3 5 2 9 2s7-.7 9-2" />
    </Svg>
  )
}

export function IconCrate(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9M7.8 5.3l8.4 4.5" />
    </Svg>
  )
}

export function IconTrophy(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v5a4 4 0 01-8 0z" />
      <path d="M8 5.5H5.5A2.5 2.5 0 008 10M16 5.5h2.5A2.5 2.5 0 0116 10M12 13v4M9.5 17h5l.5 3.5H9z" />
    </Svg>
  )
}

export function IconBracket(props: IconProps) {
  return (
    <Svg {...props}>
      {/* Four entrants → two semi-finals → one final */}
      <path d="M3 4h5v6H3M8 7h5M3 14h5v6H3M8 17h5M13 7v10M13 12h8" />
    </Svg>
  )
}
