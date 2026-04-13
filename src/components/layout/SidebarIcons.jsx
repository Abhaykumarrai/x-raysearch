/** Small stroke icons for the sidebar (Lucide-style, no extra deps). */
const iconClass = "h-[1.05rem] w-[1.05rem] shrink-0 opacity-80";

export function IconSearch({ className = "" }) {
  return (
    <svg className={`${iconClass} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconStar({ className = "" }) {
  return (
    <svg className={`${iconClass} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <polygon
        fill="none"
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClock({ className = "" }) {
  return (
    <svg className={`${iconClass} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUser({ className = "" }) {
  return (
    <svg className={`${iconClass} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
