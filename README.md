# Darken this website

A minimal Firefox add-on that takes the glare out of web pages, one tab at a time.
Forked from [lineality/invert_colors_minimal_firefox_addon](https://github.com/lineality/invert_colors_minimal_firefox_addon)
and kept in the same spirit: a handful of lines you can read in a minute, so you know exactly what runs.

- **Permissions:** `activeTab`, `storage` and access to all sites, so that switching a site on never needs a
  prompt. Nothing runs until you click the icon or press **Alt+Shift+M**, and no script runs on sites you
  did not switch on. No network.
- **Click:** the page is inverted and dimmed to 85 %: dark background, light text, blue links turn yellow. Images, video, canvas and iframes get the inversion again, which cancels it
  exactly, so photos are not negatives; they are dimmed a little more than the page (about 64 %). The site is remembered and from then on inverted on every load, before the page is
  drawn, so a refresh changes nothing.
- **Next click:** off, and the site is forgotten. A `!` badge means Firefox does not allow extensions on
  that page (about:, addons.mozilla.org, the PDF viewer).
- The list of switched-on sites is the only thing the add-on stores.

## Install

Temporary (gone after a restart): `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → `manifest.json`.

Permanent on Firefox ESR, Developer Edition or Nightly: set `xpinstall.signatures.required` to `false` in
`about:config`, then open `darken-this-website.xpi` in Firefox (Ctrl+O) and confirm. Release builds of Firefox
refuse unsigned add-ons; there the add-on would have to be signed through addons.mozilla.org first.

## Moving to another computer

The add-on does not travel with Firefox Sync. Sync only carries add-ons that were installed from
addons.mozilla.org; a self-built `.xpi` is invisible to it, and so is the list of switched-on sites, which
lives in the add-on's local storage on that machine. On a new computer:

1. Clone this repository and run `build.ps1` (or zip `manifest.json`, `background.js` and `icon.svg`).
2. In Firefox ESR, Developer Edition or Nightly, set `xpinstall.signatures.required` to `false` in `about:config`.
3. Open `darken-this-website.xpi` with Ctrl+O and confirm.
4. Switch your sites on again with a click.

If you want the site list to follow you, change `browser.storage.local` to `browser.storage.sync` in
`background.js`; Firefox then syncs the list between machines that have the add-on installed and are
signed in to the same account.

## Build

`build.ps1` packs `manifest.json`, `background.js` and `icon.svg` into `darken-this-website.xpi`.

## Tuning

At the top of `background.js`: `DIM` (0.85), `MEDIA_DIM` (0.75, extra dim for images and video) and `KEEP_HUES` (off). Switching `KEEP_HUES` on rotates hues 180 degrees after inverting so blue
links stay blue, at a price: Firefox clamps colours between the two filter passes, so saturated photos
come back slightly duller. Rebuild the .xpi afterwards.

## Original README

The README of the add-on this fork started from is kept unchanged in `README.original.md`.

## License

MIT, as the original. See `LICENSE`.
