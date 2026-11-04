import type { SVGProps } from "react";

export function TilliLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Tilli"
      {...props}
    >
      <circle cx="24" cy="24" r="24" fill="currentColor" fillOpacity={0.13} />
      <g stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 27H35V32C35 36.4 31.4 40 27 40H21C16.6 40 13 36.4 13 32Z" />
        <path d="M13 30H9.5M35 30H38.5" />
        <path d="M24 27V10.5" />
        <path d="M24 22C21.5 22 19.5 20.5 18.5 18M24 22C26.5 22 28.5 20.5 29.5 18" />
        <path d="M24 16C22 16 20.5 14.5 19.5 12.5M24 16C26 16 27.5 14.5 28.5 12.5" />
      </g>
    </svg>
  );
}