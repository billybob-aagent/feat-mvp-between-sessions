# Accessibility notes (WCAG 2.1 AA)

- Color contrast: Palette uses high-contrast HSL tokens; primary foreground ≥ 4.5:1 on both themes.
- Typography: Base size ≥ 16px; line-height ≥ 1.4; headings use semantic tags.
- Keyboard: All interactive components are focusable with visible `ring` outlines; no keyboard traps.
- Forms: Inputs have programmatic labels; status and errors are announced via visible text near controls.
- Targets: Buttons ≥ 40px height; touch targets in client UI ≥ 44px.
- Motion: Animations are subtle and short (≤ 200ms); no parallax.
- ARIA: Native elements preferred; Radix primitives used where needed.
- Reassurance: Client UI includes “Safe & private” copy; no alarming colors; destructive actions use confirmation.
