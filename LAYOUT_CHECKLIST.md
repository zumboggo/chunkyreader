# Chunky Reader Layout Checklist

Use this before deploying layout changes.

## Scrolling Ownership

- `body` is allowed to scroll. Do not add `body { overflow: hidden; }` for lesson screens.
- `.app-shell` owns the page frame and uses `min-height: 100dvh`, not fixed `height: 100vh`.
- Lesson/story content stays in normal document flow unless a child has an explicit scroll region.
- Any flex or grid child that must shrink inside a parent needs `min-height: 0`.

## Bottom Actions

- Bottom actions such as `Next`, `Back`, `Done`, and lesson choices should be in normal layout flow.
- Sticky actions may use `position: sticky; bottom: 0`, but the sticky element must include:
  - a matching background,
  - `z-index`,
  - `padding-bottom: max(..., env(safe-area-inset-bottom))`.
- Do not absolutely position action buttons at the bottom of the viewport.

## Multiple Choice Screens

- Keep prompts compact.
- Keep answer buttons `height: auto` with a touch-friendly `min-height`.
- Let long option text wrap with `overflow-wrap`.
- Avoid parent `overflow: hidden` around answer options.

## Viewports To Test

- 390 x 844
- 360 x 740
- 412 x 915
- 768 x 1024
- 1366 x 768
- 1920 x 1080

For each viewport, verify that every answer choice and action button is visible or reachable by normal scrolling.
