export function RullaaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" className="fill-primary/12" />
      <path
        d="M6 20.5c3.2-2.6 6.2-2.6 9.4 0 3.2 2.6 6.2 2.6 9.4 0"
        className="stroke-primary"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M16 5.5c3.6 0 6.2 2.6 6.2 6 0 2.4-1.5 4.2-3.6 5.2"
        className="stroke-accent"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12.4" cy="11.6" r="2.1" className="fill-accent" />
    </svg>
  );
}
