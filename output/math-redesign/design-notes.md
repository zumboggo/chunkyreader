# Math redesign

Created using the built-in imagegen tool, with math-before.png as the visual reference.

## Final generation prompt

Use case: ui-mockup. Create a polished redesign of the attached screenshot of Chunky Learner's Math page, a kawaii pastel reading and counting app for young children. Screenshot is the layout/content reference. Make it more fun, sleek and child friendly while practical to implement with HTML/CSS and existing panda artwork. Landscape 16:9 full app screenshot, no device frame. Soft warm cream background with restrained lavender and mint accents. Compact top bar: a clearly labeled house-icon Home button left, 'Number garden' centered with small 'Math' subtitle, five little progress dots right. Main central rounded white learning card, generous but efficient spacing, small '1 of 5' pill, bold friendly text 'What is 0 plus 3?', small lavender 'Listen' pill with speaker icon. A pale mint inset counting area shows large 0 + exactly three red apples. Under it exactly TWO substantial answer tiles side by side, lavender 3 and peach 4, softly raised with rounded corners. Small friendly panda and 'Take your time. Count with me.' in a subtle footer. Compact secondary operation and number range pills below the main card, all comfortably visible. Bottom four-button control dock retained, lightweight and refined with labels '1 · 3', '2 · 4', '3 · Listen', '4 · More'. Keep readable dark ink text, simple child sized targets, minimal decoration, no extra choices, no busy gradients, no photographs. This is a realistic high-fidelity UI design reference, not a poster.

## Implementation and checks

The app uses real HTML controls and existing panda artwork. The generated concept is a design reference. Actual number ranges remain 5, 10, 15, and 20. Questions are randomized, so before and after screenshots show different problems.

Files: math-before.png, math-concept.png, math-after.png.

Verified section Home buttons, Stories reader Home, Math keyboard answers and next-question transition, 390 by 844 layout without horizontal overflow or dock overlap, randomized math checks, controller and Words regression checks, lint, and production build.
