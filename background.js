// Mute Whites: nothing happens until you click the icon or press Alt+Shift+M.
// Nothing leaves the browser. The only thing stored is the list of sites you
// switched on, so they stay inverted after a reload; no script runs anywhere else.

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
// Returns "inverted" or "off".
function apply(mode, dim, mediaDim, keepHues) {
  const ID = "mute-whites-style";
  document.getElementById(ID)?.remove();
  if (mode === "off") return "off";

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

const code = (mode) => `(${apply.toString()})(${JSON.stringify(mode)}, ${DIM}, ${MEDIA_DIM}, ${KEEP_HUES});`;

const states = new Map(); // tab id -> "off" | "inverted"

function setState(tabId, result) {
  states.set(tabId, result);
  browser.browserAction.setBadgeText({ tabId, text: "" });
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
// the effect survives a reload.
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
    js: [{ code: `${code("on")} browser.runtime.sendMessage("inverted");` }],
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
}

// Click: invert the page and remember the site. Click again: switch off and
// forget the site. Two states, like the original.
async function toggle(tab) {
  const on = states.get(tab.id) !== "inverted";
  const origin = originOf(tab);
  let result;
  try {
    [result] = await browser.tabs.executeScript(tab.id, { code: code(on ? "on" : "off"), runAt: "document_start" });
  } catch (error) {
    // Pages Firefox never lets extensions touch (about:, addons.mozilla.org, PDF viewer).
    browser.browserAction.setBadgeText({ tabId: tab.id, text: "!" });
    browser.browserAction.setTitle({ tabId: tab.id, title: "Mute Whites: not allowed on this page" });
    return;
  }
  if (origin) await (on ? remember(origin) : forget(origin));
  setState(tab.id, result);
}

async function init() {
  for (const origin of await sites()) await register(origin);
}

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
