const PALETTE = [
  "#4F46E5", "#7C3AED", "#0891B2", "#059669",
  "#D97706", "#B45309", "#DC2626", "#9333EA",
  "#0284C7", "#15803D",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(31, h) + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function nameToColor(name: string): string {
  if (!name.trim()) return PALETTE[0];
  return PALETTE[hashName(name.trim()) % PALETTE.length];
}

export function nameToInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface Props {
  name: string;
  size?: number;       // px diameter, default 48
  fontSize?: number;   // px, default auto-scaled
  className?: string;
}

export function InitialsAvatar({ name, size = 48, fontSize, className }: Props) {
  const color    = nameToColor(name || "?");
  const initials = nameToInitials(name || "?");
  const fs       = fontSize ?? Math.round(size * 0.38);

  return (
    <div
      aria-label={name || "User"}
      className={className}
      style={{
        width:           size,
        height:          size,
        borderRadius:    "50%",
        backgroundColor: color,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        flexShrink:      0,
        userSelect:      "none",
      }}
    >
      <span
        style={{
          color:      "#FFFFFF",
          fontSize:   fs,
          fontWeight: 700,
          lineHeight: 1,
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
