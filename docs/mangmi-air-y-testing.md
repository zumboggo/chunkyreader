# Mangmi Air Y verification — 2026-11-17

Mangmi specifies a 1280 × 960, 4:3 screen:
https://mangmi.com/blogs/news/mangmi-air-y-series-official-release

Browser verification used isolated guest profiles with the mode enabled in Settings.
Test viewports: 1280 × 960, 640 × 480 (scaled), and 640 × 400 (reduced browser height).
The latter two are stress-test assumptions, not measured device browser dimensions.

Final sweep: 230 screen states; no detected horizontal overflow or unreachable controls.
Coverage includes home, Letters/Sounds selection and activity stages, Guided Words stages,
story library and a conventional reader, The Box Boat adventure through completion,
Math and each number range, Chinese question/answer, Phonics entry, Flashcards entry,
Panda Room/Boxes/Collection, and Parent Settings.

Screenshots were also inspected for Words, Math, Sarah letters, the early-reading picker,
Phonics, and adventures. Fixes compact the small-height layouts and position adventure
pictures beside dialogue. Long libraries and settings intentionally scroll.

Controller checks:
- X/Y/A/B and 1/2/3/4 select choices 1/2/3/4.
- Uppercase keyboard aliases, custom keys, disabled slots, modal isolation, and repeat suppression.
- Browser Gamepad API buttons 2/3/0/1 activate choices 1/2/3/4 once per press, including held presses.
- Existing directional navigation, select, modal focus, and select-input adjustment still pass.
- Added missing adventure choices, Sarah's Next actions, and completion actions to shortcut handling.

Run with the app served locally:
```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_PATH=/path/to/chrome node scripts/verify-mangmi-browser.mjs
node scripts/verify-controller.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_PATH=/path/to/chrome node scripts/verify-controller-navigation.mjs
npm run build
npm run verify:word-completion
```

The browser suite saves screenshots and results.json to TEST_OUTPUT (default /tmp/mangmi-audit).
It checks control reachability after scrolling, not that every long page fits simultaneously.
This covers screen templates and representative paths, not every curriculum item, story branch,
signed-in cloud state, or native Android keyboard. Physical device button reporting and actual
Android scaling remain unverified; the gamepad tests use the browser's standard mapping.
