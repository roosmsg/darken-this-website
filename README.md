# Mute Whites

A minimal Firefox add-on that takes the glare out of web pages, one tab at a time.
Forked from [lineality/invert_colors_minimal_firefox_addon](https://github.com/lineality/invert_colors_minimal_firefox_addon)
and kept in the same spirit: a handful of lines you can read in a minute, so you know exactly what runs.

- **Permissions:** `activeTab`, `storage` and access to all sites, so that switching a site on never needs a
  prompt. Nothing runs until you click the icon or press **Alt+Shift+M**, and no script runs on sites you
  did not switch on. No network.
- **Click:** the page is inverted and dimmed to 85 %: dark background, light text, blue links turn yellow. Images, video, canvas and iframes get the inversion again, which cancels it
  exactly, so photos are not negatives; they are dimmed a little more than the page (about 64 %). Badge `I`. The site is remembered and from then on inverted on every load, before the page is
  drawn, so a refresh changes nothing.
- **Next click:** off, and the site is forgotten. Badge `!` means Firefox does not allow extensions on that
  page (about:, addons.mozilla.org, the PDF viewer).
- The list of switched-on sites is the only thing the add-on stores.

## Install

Temporary (gone after a restart): `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → `manifest.json`.

Permanent on Firefox ESR, Developer Edition or Nightly: set `xpinstall.signatures.required` to `false` in
`about:config`, then open `mute-whites.xpi` in Firefox (Ctrl+O) and confirm. Release builds of Firefox
refuse unsigned add-ons; there the add-on would have to be signed through addons.mozilla.org first.

## Build

`build.ps1` packs `manifest.json`, `background.js` and `icon.svg` into `mute-whites.xpi`.

## Tuning

At the top of `background.js`: `DIM` (0.85), `MEDIA_DIM` (0.75, extra dim for images and video) and `KEEP_HUES` (off). Switching `KEEP_HUES` on rotates hues 180 degrees after inverting so blue
links stay blue, at a price: Firefox clamps colours between the two filter passes, so saturated photos
come back slightly duller. Rebuild the .xpi afterwards.

## Why not the original one-liner

The original sets `filter: invert(100%)` on `body`. A filter on `body` makes it the containing block for
`position: fixed`, so sticky headers and menus scroll away with the page, and photos are shown as
negatives. This fork filters the root element (which the CSS spec exempts from that rule), cancels the
filter on media and dims a little.

## Why no "mute whites to grey" mode

The obvious way to turn white into dark grey while leaving darker tones alone is an SVG tone curve
(`feComponentTransfer`). Firefox does not apply SVG reference filters on the root element, and putting it
on `body` brings back the `position: fixed` problem, so that mode was dropped in favour of inverting
only the pages that are light.

## License

MIT, as the original. See `LICENSE`.
