interface Props {
  className?: string;
}

/** SVG filament spool icon — front-on view with wound filament layers */
export default function SpoolIcon({ className = "w-7 h-7" }: Props) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer flange ring */}
      <circle cx="14" cy="14" r="12.5" stroke="currentColor" strokeWidth="1.8" />

      {/* Wound filament layers (dashed concentric circles) */}
      <circle
        cx="14" cy="14" r="9.5"
        stroke="currentColor" strokeWidth="1.2"
        strokeDasharray="3.2 1.8"
        strokeLinecap="round"
      />
      <circle
        cx="14" cy="14" r="7"
        stroke="currentColor" strokeWidth="1.1"
        strokeDasharray="2.6 1.6"
        strokeLinecap="round"
      />
      <circle
        cx="14" cy="14" r="4.8"
        stroke="currentColor" strokeWidth="1"
        strokeDasharray="2 1.4"
        strokeLinecap="round"
      />

      {/* Core hub */}
      <circle cx="14" cy="14" r="2.8" stroke="currentColor" strokeWidth="1.5" />

      {/* Centre axle hole */}
      <circle cx="14" cy="14" r="1.1" fill="currentColor" />
    </svg>
  );
}
