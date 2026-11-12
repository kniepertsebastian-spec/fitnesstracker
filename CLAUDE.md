# FitnessTracker – Project Design Rules

## Visual identity
- Product style: Purple Performance.
- Dark, premium, athletic, focused and technically polished.
- Background: deep navy and charcoal with subtle purple gradients and abstract flowing shapes.
- Primary accent: violet/purple. Suggested tokens: `#8B5CF6`, `#A855F7`, `#C084FC`.
- Surfaces: `#111A2E` and `#1B2542`.
- Text: `#F3F0FF`, secondary text `#9BA3BD`.
- Use green only for meaningful success/status indicators, not as the dominant brand color.

## Strict background restrictions
- Never use people, men, women, fitness models, human silhouettes or stock photography as backgrounds.
- Prefer CSS gradients, SVG, abstract geometry and subtle textures.
- Background effects must never compromise readability or training usability.

## UX priorities
- Active workouts and logging sets must remain fast and intuitive.
- Weight, reps, rest timers and training progress must be immediately readable.
- Prioritize mobile-first layouts, accessible touch targets and clear interaction states.
- Keep the active workout screen visually calm and distraction-free.
- Use real application data and existing functions, never static mock data as a replacement for working features.

## Engineering constraints
- Inspect the existing architecture before making changes.
- Preserve business logic, APIs, data models, persistence, authentication and existing features.
- Avoid unnecessary dependencies and unrelated refactoring.
- Use reusable components and centralized design tokens where appropriate.
- Never modify production files until the user explicitly approves the design plan.
- Validate changes with available builds, tests and visual screenshots.

