import { cn } from "@workspace/ui/lib/utils";

type LogoProps = {
  /** Height in px. Default 32. */
  size?: number;
  /** Full wordmark or mark-only. */
  variant?: "lockup" | "mark";
  /**
   * Which logo color set to use.
   * - `"dark"` — light-colored logo for dark backgrounds (navy headers/footers)
   * - `"light"` — dark-colored logo for light backgrounds
   * - `"auto"` — follows the app theme via CSS
   */
  forBackground?: "dark" | "light" | "auto";
  className?: string;
};

const LAVENDER = "#9b8ce8";

function MarkGlyph({ ink }: { ink: string }) {
  return (
    <g>
      <rect
        x="1.5"
        y="1.5"
        width="33"
        height="33"
        rx="5"
        ry="5"
        fill="none"
        stroke={LAVENDER}
        strokeWidth="1.5"
      />
      <text
        x="18"
        y="24.5"
        textAnchor="middle"
        fill={ink}
        style={{ fontFamily: "var(--font-serif), 'Libre Caslon Text', serif", fontSize: "18px", fontWeight: 400 }}
      >
        iL
      </text>
    </g>
  );
}

function LockupGlyph({ ink }: { ink: string }) {
  return (
    <g>
      <g transform="translate(0, 4)">
        <MarkGlyph ink={ink} />
      </g>
      <text
        x="44"
        y="22"
        fill={ink}
        style={{ fontFamily: "var(--font-serif), 'Libre Caslon Text', serif", fontSize: "22px", fontWeight: 400 }}
      >
        ilovelawyer
      </text>
      <text
        x="44"
        y="36"
        fill={ink}
        opacity={0.85}
        style={{
          fontFamily: "var(--font-sans), Inter, sans-serif",
          fontSize: "7.5px",
          fontWeight: 500,
          letterSpacing: "0.22em",
        }}
      >
        LEGAL INTELLIGENCE
      </text>
    </g>
  );
}

function LogoSvg({
  ink,
  variant,
  size,
  className,
  ariaHidden,
}: {
  ink: string;
  variant: "lockup" | "mark";
  size: number;
  className?: string;
  ariaHidden?: boolean;
}) {
  const aspect = variant === "mark" ? 1 : 4.15;
  const width = Math.round(size * aspect);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={size}
      viewBox={variant === "mark" ? "0 0 36 36" : "0 0 190 44"}
      className={className}
      role={ariaHidden ? undefined : "img"}
      aria-hidden={ariaHidden || undefined}
      aria-label={ariaHidden ? undefined : "ilovelawyer"}
    >
      {variant === "mark" ? <MarkGlyph ink={ink} /> : <LockupGlyph ink={ink} />}
    </svg>
  );
}

export function Logo({
  size = 32,
  variant = "lockup",
  forBackground = "auto",
  className,
}: LogoProps) {
  if (forBackground === "light") {
    return <LogoSvg ink="#14161c" variant={variant} size={size} className={className} />;
  }

  if (forBackground === "dark") {
    return <LogoSvg ink="#ffffff" variant={variant} size={size} className={className} />;
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <LogoSvg ink="#14161c" variant={variant} size={size} className="dark:hidden" />
      <LogoSvg ink="#ffffff" variant={variant} size={size} className="hidden dark:block" ariaHidden />
    </span>
  );
}
