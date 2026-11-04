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
      <g stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 41C24 33 24 25 24 17.5" />
        <path d="M24 17.5L13.5 12M24 17.5L18 8M24 17.5L24 6.5M24 17.5L30 8M24 17.5L34.5 12" />
        <path d="M24 27C21 27 18 25.5 16 22.5M24 27C21 28 18 28.5 15 28M24 27C27 27 30 25.5 32 22.5M24 27C27 28 30 28.5 33 28" />
        <path d="M24 35C21 35 18.5 33.5 17 31M24 35C21 36 18.5 36.5 16.5 36M24 35C27 35 29.5 33.5 31 31M24 35C27 36 29.5 36.5 31.5 36" />
      </g>
      <g fill="currentColor">
        <circle cx="13.5" cy="12" r="1.7" />
        <circle cx="18" cy="8" r="1.7" />
        <circle cx="24" cy="6.5" r="1.7" />
        <circle cx="30" cy="8" r="1.7" />
        <circle cx="34.5" cy="12" r="1.7" />
      </g>
    </svg>
  );
}