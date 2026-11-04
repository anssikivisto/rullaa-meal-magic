import { useEffect, useState, type CSSProperties } from "react";

const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2300);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="splash" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" className="h-28 w-28 text-primary">
        <circle
          className="splash-circle"
          cx="24"
          cy="24"
          r="24"
          fill="currentColor"
          fillOpacity={0.13}
        />
        <g stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path
            className="splash-path"
            pathLength={1}
            style={delay(0.2)}
            d="M13 27H35V32C35 36.4 31.4 40 27 40H21C16.6 40 13 36.4 13 32Z"
          />
          <path className="splash-path" pathLength={1} style={delay(0.5)} d="M13 30H9.5M35 30H38.5" />
          <path className="splash-path" pathLength={1} style={delay(0.65)} d="M24 27V10.5" />
          <path
            className="splash-path"
            pathLength={1}
            style={delay(0.85)}
            d="M24 22C21.5 22 19.5 20.5 18.5 18M24 22C26.5 22 28.5 20.5 29.5 18"
          />
          <path
            className="splash-path"
            pathLength={1}
            style={delay(1.0)}
            d="M24 16C22 16 20.5 14.5 19.5 12.5M24 16C26 16 27.5 14.5 28.5 12.5"
          />
        </g>
      </svg>
      <span className="splash-word font-display text-4xl font-semibold text-primary">Tilli</span>
    </div>
  );
}