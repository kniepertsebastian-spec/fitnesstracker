// The app's one graphic motif: two flowing violet light bands behind the content, top right.
// Pure SVG on CSS tokens — no image files, no blur. Fixed and inert (aria-hidden, no pointer
// events). Rendered by AppShell and AuthLayout, never in the training focus screen, which stays calm.
export function LightBand() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        className="absolute -right-[420px] -top-40 h-[620px] w-[980px] max-w-none opacity-40 lg:-right-24 lg:-top-32 lg:opacity-70"
        viewBox="0 0 980 620"
        fill="none"
      >
        <defs>
          <linearGradient id="lightband-a" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="0.55" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--accent-text)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="lightband-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--accent-hover)" stopOpacity="0" />
            <stop offset="0.7" stopColor="var(--accent-text)" stopOpacity="0.4" />
            <stop offset="1" stopColor="var(--accent-text)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="lightband-glow" cx="0.78" cy="0.22" r="0.55">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="980" height="620" fill="url(#lightband-glow)" />
        <path
          d="M40 470 C 260 420, 380 250, 590 230 S 880 260, 980 110 L 980 190 C 880 330, 700 300, 600 310 S 300 470, 40 470 Z"
          fill="url(#lightband-a)"
        />
        <path d="M120 520 C 360 470, 470 300, 650 280 S 900 250, 990 140" stroke="url(#lightband-b)" strokeWidth="1.5" />
        <path d="M260 560 C 470 500, 560 360, 720 340 S 920 310, 990 230" stroke="url(#lightband-b)" strokeWidth="1" />
      </svg>
    </div>
  );
}
