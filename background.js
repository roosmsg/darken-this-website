// Mute Whites: everything happens in the active tab, only after you click the
// icon or press Alt+Shift+M. Nothing is stored and nothing leaves the browser.

// Pages whose background is brighter than this are inverted; darker pages are
// left alone, since they already have a dark mode. 0 = black, 1 = white.
const LIGHT_THRESHOLD = 0.65;
// Brightness applied on top of the inversion, so the result is a little
// dimmer than a plain inverted page.
const DIM = 0.85;
// true: rotate hues 180 degrees after inverting so blue stays blue; saturated
// photos come back slightly duller, because the browser clamps colours between
// the two filter passes. false: plain inversion, page colours become their
// complements, but images and video are restored exactly.
const KEEP_HUES = true;

// Runs inside the page. Must be self-contained: it is sent as source text.
// Returns "inverted", "skipped" or "off".
function apply(mode, threshold, dim, keepHues) {
  const ID = "mute-whites-style";
  document.getElementById(ID)?.remove();
  if (mode === "off") return "off";

  // Background luminance at a few points of the viewport, walking up from the
  // element under each point to the first ancestor that paints a background.
  // The canvas itself is white when nothing paints one.
  const parse = (color) => {
    const m = color && color.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3 || (m.length > 3 && Number(m[3]) === 0)) return null;
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  };
  const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const backgroundOf = (element) => {
    for (let e = element; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c) return c;
    }
    return [255, 255, 255];
  };
  const w = innerWidth, h = innerHeight;
  const points = [[w / 2, h / 2], [w * 0.1, h * 0.1], [w * 0.9, h * 0.1], [w * 0.1, h * 0.9], [w * 0.9, h * 0.9]];
  const samples = points.map(([x, y]) => document.elementFromPoint(x, y)).filter(Boolean).map((e) => luminance(backgroundOf(e)));
  if (!samples.length) samples.push(luminance(backgroundOf(document.body || document.documentElement)));
  samples.sort((a, b) => a - b);
  const light = samples[Math.floor(samples.length / 2)] > threshold;
  if (mode === "auto" && !light) return "skipped";

  // Invert with a 180 degree hue rotation so colours keep their hue (blue stays
  // blue), then dim a little. Media gets the inversion again, which cancels
  // it, so photos are not negatives; the dim stays. The filter sits on the
  // root element, which the CSS spec exempts from breaking position: fixed.
  const invert = keepHues ? "invert(1) hue-rotate(180deg)" : "invert(1)";
  const style = document.createElement("style");
  style.id = ID;
  style.textContent =
    `html { filter: ${invert} brightness(${dim}) !important; }` +
    `img, picture, video, canvas, object, embed, iframe { filter: ${invert} !important; }`;
  document.documentElement.appendChild(style);
  return "inverted";
}

// Click 1 inverts a light page (or reports "–" when the page is dark already),
// a click on a skipped page inverts it anyway, the next click switches off.
const NEXT = { off: "auto", inverted: "off", skipped: "force" };
const BADGE = { off: "", inverted: "I", skipped: "–" };
const states = new Map(); // tab id -> "off" | "inverted" | "skipped"

async function cycle(tab) {
  const mode = NEXT[states.get(tab.id) || "off"];
  let result;
  try {
    [result] = await browser.tabs.executeScript(tab.id, {
      code: `(${apply.toString()})(${JSON.stringify(mode)}, ${LIGHT_THRESHOLD}, ${DIM}, ${KEEP_HUES});`,
      runAt: "document_start",
    });
  } catch (error) {
    // Pages Firefox never lets extensions touch (about:, addons.mozilla.org, PDF viewer).
    browser.browserAction.setBadgeText({ tabId: tab.id, text: "!" });
    browser.browserAction.setTitle({ tabId: tab.id, title: "Mute Whites: not allowed on this page" });
    return;
  }
  states.set(tab.id, result);
  browser.browserAction.setBadgeText({ tabId: tab.id, text: BADGE[result] });
}

browser.browserAction.setBadgeBackgroundColor({ color: "#444" });
browser.browserAction.onClicked.addListener(cycle);
browser.commands.onCommand.addListener(async (command) => {
  if (command !== "cycle") return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab) cycle(tab);
});

// The injected style is gone after a navigation, so forget the tab's state.
browser.tabs.onUpdated.addListener((tabId, info) => { if (info.status === "loading") states.delete(tabId); });
browser.tabs.onRemoved.addListener((tabId) => states.delete(tabId));
