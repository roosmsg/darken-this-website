// Mute Whites: everything happens in the active tab, only after you click the
// icon or press Alt+Shift+M. Nothing leaves the browser. The only thing stored
// is the list of sites you switched on, so they stay inverted after a reload.

// Pages whose background is brighter than this are inverted; darker pages are
// left alone, since they already have a dark mode. 0 = black, 1 = white.
const LIGHT_THRESHOLD = 0.65;
// Brightness applied on top of the inversion, so the result is a little
// dimmer than a plain inverted page.
const DIM = 0.85;
// Extra brightness factor for images and video, on top of DIM, because they
// come back at full strength after the second inversion.
const MEDIA_DIM = 0.75;
// true: rotate hues 180 degrees after inverting so blue stays blue; saturated
// photos come back slightly duller, because the browser clamps colours between
// the two filter passes. false: plain inversion, page colours become their
// complements, but images and video are restored exact.
const KEEP_HUES = false;

// Runs inside the page. Must be self-contained: it is sent as source text.
// Returns "inverted", "skipped" or "off".
function apply(mode, threshold, dim, mediaDim, keepHues) {
  const ID = "mute-whites-style";
  document.getElementById(ID)?.remove();
  if (mode === "off") return "off";

  if (mode === "auto") {
    // Background luminance at a few points of the viewport, walking up from
    // the element under each point to the first ancestor that paints a
    // background. The canvas itself is white when nothing paints one.
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
    if (samples[Math.floor(samples.length / 2)] <= threshold) return "skipped";
  }

  // Invert, then dim a little. Media gets the inversion again, which cancels
  // it, so photos are not negatives, plus its own dim. That dim must come
  // before the inner inversion: applied after it, the outer inversion would
  // turn it into lifted blacks instead of darker images. The filter sits on
  // the root element, which the CSS spec exempts from breaking position: fixed.
  const invert = keepHues ? "invert(1) hue-rotate(180deg)" : "invert(1)";
  const style = document.createElement("style");
  style.id = ID;
  style.textContent =
    `html { filter: ${invert} brightness(${dim}) !important; }` +
    `img, picture, video, canvas, object, embed, iframe { filter: brightness(${mediaDim}) ${invert} !important; }`;
  document.documentElement.appendChild(style);
  return "inverted";
}

const code = (mode) => `(${apply.toString()})(${JSON.stringify(mode)}, ${LIGHT_THRESHOLD}, ${DIM}, ${MEDIA_DIM}, ${KEEP_HUES});`;

const BADGE = { off: "", inverted: "I", skipped: "–" };
const states = new Map(); // tab id -> "off" | "inverted" | "skipped"

function setState(tabId, result) {
  states.set(tabId, result);
  browser.browserAction.setBadgeText({ tabId, text: BADGE[result] });
}

function originOf(tab) {
  try {
    const origin = new URL(tab.url).origin;
    return /^https?:/.test(origin) ? origin : null;
  } catch (error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Switched-on sites are inverted on every load, before the page is drawn, so
// the effect survives a reload. Each site needs its own host permission, which
// Firefox asks you for once; the add-on never gets access to any other site.
// ---------------------------------------------------------------------------
const registrations = new Map(); // origin -> RegisteredContentScript

async function sites() {
  const { sites } = await browser.storage.local.get({ sites: [] });
  return sites;
}

async function register(origin) {
  if (registrations.has(origin)) return;
  const registration = await browser.contentScripts.register({
    matches: [origin + "/*"],
    js: [{ code: `${code("force")} browser.runtime.sendMessage("inverted");` }],
    runAt: "document_start",
  });
  registrations.set(origin, registration);
}

async function remember(origin) {
  const list = await sites();
  if (!list.includes(origin)) await browser.storage.local.set({ sites: [...list, origin] });
  await register(origin);
}

async function forget(origin) {
  const list = await sites();
  if (list.includes(origin)) await browser.storage.local.set({ sites: list.filter((s) => s !== origin) });
  registrations.get(origin)?.unregister();
  registrations.delete(origin);
  // The site's permission is kept, so switching it on again needs no prompt.
  // Revoke it under the add-on's permissions in about:addons if you want.
}

// Click on a light page: invert it and remember the site. Click on a dark
// page: report "–"; a second click inverts it anyway and remembers it. Click
// on an inverted page: switch off and forget the site (its permission stays).
async function toggle(tab) {
  const state = states.get(tab.id) || "off";
  const origin = originOf(tab);

  if (state === "inverted") {
    try { await browser.tabs.executeScript(tab.id, { code: code("off"), runAt: "document_start" }); } catch (error) { /* nothing injected */ }
    if (origin) await forget(origin);
    setState(tab.id, "off");
    return;
  }

  // The permission prompt has to come first: Firefox only allows it while the
  // click is still being handled, and that is over after the first await.
  const granted = origin ? await browser.permissions.request({ origins: [origin + "/*"] }) : false;
  let result;
  try {
    [result] = await browser.tabs.executeScript(tab.id, { code: code(state === "skipped" ? "force" : "auto"), runAt: "document_start" });
  } catch (error) {
    // Pages Firefox never lets extensions touch (about:, addons.mozilla.org, PDF viewer).
    browser.browserAction.setBadgeText({ tabId: tab.id, text: "!" });
    browser.browserAction.setTitle({ tabId: tab.id, title: "Mute Whites: not allowed on this page" });
    return;
  }
  if (result === "inverted" && granted) await remember(origin);
  setState(tab.id, result);
}

async function init() {
  for (const origin of await sites()) {
    if (await browser.permissions.contains({ origins: [origin + "/*"] })) await register(origin);
  }
}

browser.browserAction.setBadgeBackgroundColor({ color: "#444" });
browser.browserAction.onClicked.addListener(toggle);
browser.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle") return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab) toggle(tab);
});
// A switched-on site reports in when its content script has run.
browser.runtime.onMessage.addListener((message, sender) => {
  if (message === "inverted" && sender.tab) setState(sender.tab.id, "inverted");
});

// The injected style is gone after a navigation, so forget the tab's state.
browser.tabs.onUpdated.addListener((tabId, info) => { if (info.status === "loading") states.delete(tabId); });
browser.tabs.onRemoved.addListener((tabId) => states.delete(tabId));

init();
