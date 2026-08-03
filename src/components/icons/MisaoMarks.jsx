/**
 * MISAO Marks v1 — geometric, thin stroke, currentColor.
 * Style contract: 24×24, stroke 1.5, round/square caps, monochrome.
 */

const svgBase = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
}

function Mark({ className = 'w-5 h-5', children, ...rest }) {
  return (
    <svg
      {...svgBase}
      className={`inline-block shrink-0 align-middle ${className}`}
      {...rest}
    >
      {children}
    </svg>
  )
}

/** Home — house mark (matches assets/icons/home.svg). */
export function HomeMark({ className }) {
  return (
    <svg
      viewBox="0 0 719 789"
      fill="currentColor"
      stroke="none"
      className={`inline-block shrink-0 align-middle ${className || 'w-4 h-4'}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M370.11 5.26476L708.684 267.618C715.105 273.163 718.32 280.022 718.32 288.204V762.558C718.32 769.575 715.981 775.698 711.312 780.954C706.047 785.912 699.775 788.409 692.478 788.409H497.568C490.551 788.409 484.568 785.912 479.601 780.945C474.345 775.689 471.717 769.566 471.717 762.549V472.155H247.032V762.549C247.032 769.566 244.553 775.689 239.577 780.945C234.619 785.912 228.487 788.409 221.19 788.409H26.28C19.272 788.409 13.14 785.912 7.884 780.945C2.628 775.689 0 769.566 0 762.549V288.195C0 279.724 3.36384 273.023 10.074 268.056L337.698 5.256C342.656 1.752 348.061 0 353.904 0C360.027 0.00876 365.432 1.752 370.11 5.26476ZM327.177 582.102C335.937 573.631 346.598 569.409 359.16 569.409C372.3 569.409 383.101 573.631 391.572 582.102C400.919 591.44 405.597 602.39 405.597 614.952C405.597 627.514 400.928 638.306 391.572 647.355C383.101 656.404 372.3 660.942 359.16 660.942C346.598 660.942 335.946 656.404 327.186 647.355C318.137 638.306 313.617 627.505 313.617 614.952C313.617 602.399 318.128 591.449 327.177 582.102Z"
      />
    </svg>
  )
}

/** Echo mark (matches assets/icons/echo.svg / echo2). */
export function SquareMark({ className }) {
  return (
    <svg
      viewBox="0 0 789 574"
      fill="currentColor"
      stroke="none"
      className={`inline-block shrink-0 align-middle ${className || 'w-4 h-4'}`}
      aria-hidden
    >
      <path d="M115.604 565.976C125.298 575.421 140.732 575.325 150.281 565.784C159.878 556.242 159.975 540.775 150.522 531.088C85.751 466.228 49.3868 378.38 49.3868 286.723C49.3868 195.118 85.751 107.221 150.522 42.3582C155.248 37.7805 157.949 31.4679 157.997 24.8657C158.094 18.264 155.441 11.903 150.811 7.22886C146.133 2.55461 139.767 -0.0474552 133.16 0.000655475C126.504 0.0488525 120.186 2.74741 115.604 7.46978C41.5732 81.5824 0 182 0 286.721C0 391.442 41.5735 491.861 115.604 565.976Z" />
      <path d="M237.471 95.2338C232.838 90.6042 226.565 88 220.001 88C213.437 88 207.164 90.6042 202.531 95.2338C151.618 146.255 123 215.362 123 287.355C123 359.402 151.618 428.514 202.531 479.476C207.164 484.25 213.486 486.951 220.097 486.999C226.709 487.048 233.079 484.443 237.76 479.766C242.442 475.088 245.048 468.722 244.999 462.115C244.903 455.508 242.2 449.191 237.471 444.561C195.823 402.847 172.418 346.328 172.418 287.353C172.418 228.423 195.823 171.902 237.471 130.145C247.123 120.5 247.123 104.878 237.471 95.2338Z" />
      <path d="M638.241 7.2098C628.586 16.9611 628.586 32.6021 638.241 42.354C703.121 107.234 739.567 195.237 739.567 287.009C739.567 378.78 703.121 466.832 638.241 531.712C628.586 541.416 628.586 557.105 638.241 566.807C642.972 571.345 649.247 573.903 655.765 574C662.33 573.952 668.606 571.393 673.336 566.807C747.388 492.562 789 391.914 789 287.006C789 182.098 747.388 81.5021 673.336 7.20487C663.633 -2.40162 647.943 -2.3967 638.241 7.2098Z" />
      <path d="M290.203 182.32C248.022 224.651 235.387 288.34 258.254 343.637C281.075 398.938 334.834 435 394.5 435C454.166 435 507.927 398.936 530.745 343.637C553.613 288.336 540.978 224.647 498.797 182.32C441.194 124.56 347.81 124.56 290.203 182.32Z" />
      <path d="M551.228 478.849C560.913 488.384 576.507 488.384 586.192 478.849C637.283 427.899 666 358.939 666 287C666 215.102 637.283 146.09 586.192 95.1873C576.555 85.6042 560.913 85.6042 551.228 95.1873C541.591 104.77 541.591 120.374 551.228 129.956C593.069 171.659 616.507 228.147 616.507 286.991C616.507 345.886 593.069 402.374 551.228 444.075C546.627 448.65 544.012 454.91 544.012 461.46C544.012 467.961 546.627 474.226 551.228 478.849Z" />
    </svg>
  )
}

/** Alias for Echo mark. */
export function EchoMark({ className }) {
  return <SquareMark className={className} />
}

/** Rabbit Hole — solid mark (matches assets/icons/rabbithole.svg). */
export function RabbitMark({ className }) {
  return (
    <svg
      viewBox="0 0 675 677"
      fill="currentColor"
      stroke="none"
      className={`inline-block shrink-0 align-middle ${className || 'w-4 h-4'}`}
      aria-hidden
    >
      <path d="M98.8535 99.0789C2.33769 195.897 -26.5718 341.564 25.7511 468.037C77.9671 594.519 200.975 677 337.499 677C474.024 677 597.037 594.517 649.247 468.037C701.573 341.556 672.662 195.889 576.145 99.0789C444.343 -33.0263 230.667 -33.0263 98.8535 99.0789Z" />
    </svg>
  )
}

/** Messages. */
export function MessagesMark({ className }) {
  return (
    <Mark className={className} strokeLinecap="square">
      <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3v-3H5.5A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5z" />
      <path d="M8.5 10.5h7M8.5 13h4.5" />
    </Mark>
  )
}

/** Caves — chamber (filled, matches caves.svg mask art). */
export function CavesMark({ className }) {
  return (
    <Mark className={className} fill="currentColor" stroke="none">
      <path
        fillRule="evenodd"
        d="M12 5.9C10.55 6.35 8.7 7.7 7 9.55C4.7 12.05 3.4 15.2 3.1 17.85C2.9 19.5 3.9 20.65 5.5 20.65H18.5C20.1 20.65 21.1 19.5 20.9 17.85C20.6 15.2 19.3 12.05 17 9.55C15.3 7.7 13.45 6.35 12 5.9ZM9.05 20.65C9.25 18.2 10.45 16.45 12 16.45C13.55 16.45 14.75 18.2 14.95 20.65H9.05Z"
      />
    </Mark>
  )
}

/** Profile. */
export function ProfileMark({ className }) {
  return (
    <Mark className={className}>
      <circle cx="12" cy="9" r="2.75" />
      <path d="M6.5 18.5c.9-2.6 2.9-4 5.5-4s4.6 1.4 5.5 4" />
      <circle cx="12" cy="12" r="8" />
    </Mark>
  )
}

/** Aura — double ring. */
export function AuraMark({ className, active = false }) {
  return (
    <Mark className={className}>
      <circle cx="12" cy="12" r="3" fill={active ? 'currentColor' : 'none'} />
      <circle cx="12" cy="12" r="6.5" />
    </Mark>
  )
}

/** Comment / thought. */
export function CommentMark({ className }) {
  return (
    <Mark className={className}>
      <rect x="4.5" y="5.5" width="15" height="10.5" rx="0.5" />
      <path d="M9 16v3.5L13 16" />
    </Mark>
  )
}

/** React plus. */
export function ReactPlusMark({ className }) {
  return (
    <Mark className={className} strokeLinecap="square">
      <path d="M12 6.5v11M6.5 12h11" />
    </Mark>
  )
}

/** Show to frens — three nodes. */
export function ShowMark({ className, active = false }) {
  return (
    <Mark className={className} strokeLinecap="square">
      <circle cx="7" cy="12" r="2" fill={active ? 'currentColor' : 'none'} />
      <circle cx="17" cy="8" r="2" fill={active ? 'currentColor' : 'none'} />
      <circle cx="17" cy="16" r="2" fill={active ? 'currentColor' : 'none'} />
      <path d="M9 11.4l5.8-2.5M9 12.6l5.8 2.5" />
    </Mark>
  )
}

/** Share. */
export function ShareMark({ className }) {
  return (
    <Mark className={className} strokeLinecap="square">
      <path d="M12 14.5V4.5" />
      <path d="M8 8l4-3.5L16 8" />
      <path d="M5 12.5v5.5h14v-5.5" />
    </Mark>
  )
}

/** Hearth reaction. */
export function HearthMark({ className }) {
  return (
    <Mark className={className}>
      <path d="M12 19.5c-3.8-2.2-6-5.1-6-8.2C6 8 8.7 5.5 12 5.5c.7 1.8 1.2 3.1 1.2 4.5 0 1-.3 1.9-.9 2.7" />
      <path d="M12 19.5c3.8-2.2 6-5.1 6-8.2 0-2.1-1.1-4-2.8-5.2" />
    </Mark>
  )
}

/** Fire reaction. */
export function FireMark({ className }) {
  return (
    <Mark className={className}>
      <path d="M12 19.5c3.2-1 5.2-3.6 5.2-6.7 0-3-1.8-4.9-3.2-6 .2 1.9-.3 3.1-1.2 3.9.1-2.2-.5-4.3-.8-5.7-1.3 1.6-3.4 3.8-3.4 6.8 0 2.7 1.4 5.3 3.4 7.7z" />
    </Mark>
  )
}

/** Thunder reaction. */
export function ThunderMark({ className }) {
  return (
    <Mark className={className}>
      <path d="M12.8 3.5L7 13h4.5l-1.2 7.5L17.2 10h-4l-.4-6.5z" />
    </Mark>
  )
}

/** Bell. */
export function BellMark({ className }) {
  return (
    <Mark className={className}>
      <path d="M7.5 10.5a4.5 4.5 0 0 1 9 0c0 3.8 1.5 5 1.5 5h-12s1.5-1.2 1.5-5z" />
      <path d="M10.5 18a1.6 1.6 0 0 0 3 0" />
    </Mark>
  )
}

/** Music. */
export function MusicMark({ className }) {
  return (
    <Mark className={className}>
      <path d="M10 17.5V7.2l9-1.7V14" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="14" r="2.5" />
    </Mark>
  )
}

/** More ··· */
export function MoreMark({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className={`inline-block shrink-0 align-middle ${className || 'w-4 h-4'}`}
      aria-hidden
    >
      <circle cx="6.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="17.5" cy="12" r="1.2" />
    </svg>
  )
}

/** App wordmark glyph (header). */
export function MisaoMark({ className = 'w-6 h-6' }) {
  return (
    <Mark className={className} strokeWidth={1.35}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    </Mark>
  )
}

export const NAV_MARKS = {
  home: HomeMark,
  echoes: SquareMark,
  rabbit: RabbitMark,
  messages: MessagesMark,
  caves: CavesMark,
  profile: ProfileMark,
}

export const REACTION_MARKS = {
  hearth: HearthMark,
  fire: FireMark,
  thunder: ThunderMark,
}
