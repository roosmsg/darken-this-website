# Mute Whites

A minimal Firefox add-on that takes the glare out of web pages, one tab at a time.
Forked from [lineality/invert_colors_minimal_firefox_addon](https://github.com/lineality/invert_colors_minimal_firefox_addon)
and kept in the same spirit: a handful of lines you can read in a minute, so you know exactly what runs.

- **Permission:** `activeTab` only. Nothing runs until you click the icon or press **Alt+Shift+M**, and then
  only in that tab. No storage, no network, no content scripts on other pages.
- **Click:** if the page has a light background it is inverted (hues rotated back, so blue stays blue) and
  dimmed to 85 %. Images, video, canvas and iframes get the inversion again, which cancels it, so photos are
  not negatives. Badge `I`.
- **Pages that are already dark** are left alone; badge `–`. A second click inverts them anyway.
- **Next click:** off. Badge `!` means Firefox does not allow extensions on that page (about:,
  addons.mozilla.org, the PDF viewer).
- The effect lives in the page, so it is gone after a navigation; click again.

## Install

Temporary (gone after a restart): `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → `manifest.json`.

Permanent on Firefox ESR, Developer Edition or Nightly: set `xpinstall.signatures.required` to `false` in
`about:config`, then open `mute-whites.xpi` in Firefox (Ctrl+O) and confirm. Release builds of Firefox
refuse unsigned add-ons; there the add-on would have to be signed through addons.mozilla.org first.

## Build

`build.ps1` packs `manifest.json`, `background.js` and `icon.svg` into `mute-whites.xpi`.

## Tuning

At the top of `background.js`: `LIGHT_THRESHOLD` (0.65: anything brighter counts as a light page), `DIM`
(0.85) and `KEEP_HUES`. With `KEEP_HUES` on, saturated photos come back slightly duller, because the
browser clamps colours between the two filter passes; switch it off for exact images at the cost of page
colours becoming their complements. Rebuild the .xpi afterwards.

## Why not the original one-liner

The original sets `filter: invert(100%)` on `body`. A filter on `body` makes it the containing block for
`position: fixed`, so sticky headers and menus scroll away with the page, and photos are shown as
negatives. This fork filters the root element (which the CSS spec exempts from that rule), cancels the
filter on media, dims a little and only acts on pages that need it.

## Why no "mute whites to grey" mode

The obvious way to turn white into dark grey while leaving darker tones alone is an SVG tone curve
(`feComponentTransfer`). Firefox does not apply SVG reference filters on the root element, and putting it
on `body` brings back the `position: fixed` problem, so that mode was dropped in favour of inverting
only the pages that are light.

## License

MIT, as the original. See `LICENSE`.
