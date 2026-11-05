# Handheld navigation

Use a browser that exposes the handheld controls through the standard Gamepad API (serve the app over HTTPS). Press a controller button after opening the app. Actual Mangmi Air Y hardware has not yet been tested.

- D-pad / left stick: move the purple highlight.
- A (bottom face button): select the highlighted control.
- B (right face button): close the dialog or use the screen's Back/Home control.
- L1 / R1: previous / next control in reading order. These also leave sliders and selection lists.
- On a slider or selection list, directions change the value.
- Keyboard: arrows, Enter/Space, Escape, Tab/Shift+Tab.
- Text fields still require the Android on-screen keyboard or an attached keyboard.

Touch remains available. Existing configurable numbered lesson shortcuts still work; navigation keys take precedence. Unknown nonstandard gamepad mappings are ignored rather than guessing button assignments. If the device isn't recognized, keyboard mapping to arrows/Enter/Escape is supported.

Focus stays inside dialogs, recovers when controls disappear, and scrolls into view. Confirm and Back fire once per press; directional movement repeats while held. Navigation only focuses controls: it does not play answers or mark reading as independent.

Browser regression check (requires Playwright and a Chromium installation):

```sh
node scripts/verify-controller-navigation.mjs
```

For a shared Playwright installation, set `PLAYWRIGHT_MODULE` to its module path. Set `CHROME_PATH` to use an existing Chrome executable.
