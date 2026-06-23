export function Logo({ textColor = "#0a192f", size = 32 }: { textColor?: string; size?: number }) {
  return (
    <span style={{ fontSize: size, color: textColor, fontFamily: "'Source Serif 4', serif", fontWeight: 400, letterSpacing: "-0.02em" }}>
      ilove<span style={{ color: "#d4af37" }}>lawyer</span>
    </span>
  );
}
