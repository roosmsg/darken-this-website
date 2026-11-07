// Darken this website: nothing happens until you click the icon or press Alt+Shift+M.
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
// true: follow the system colour scheme. Remembered sites are inverted only
// while the system is in dark mode; when it switches to light mode every
// inverted tab is restored, and when it switches back they are inverted again.
// A click works in either mode and lasts until the next load. false: remembered
// sites are inverted whatever the system does.
const FOLLOW_SYSTEM = true;

// Runs inside the page. Must be self-contained: it is sent as source text.
// Returns "inverted" or "off".
function apply(mode, dim, mediaDim, keepHues) {
  const ID = "darken-this-website-style";

  // A page stylesheet does not reach into shadow DOM, so a video player built
  // as a web component (its <video> inside an open shadow root) would stay
  // inverted. Every open shadow root gets its own copy of the media rule, and
  // a MutationObserver keeps that up to date for players added later. Closed
  // shadow roots cannot be reached and stay inverted.
  const shadowRoots = (root, found = []) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot) {
        found.push(el.shadowRoot);
        shadowRoots(el.shadowRoot, found);
      }
    }
    return found;
  };

  globalThis.darkenObserver?.disconnect();
  clearTimeout(globalThis.darkenTimer);
  for (const root of [document, ...shadowRoots(document)]) root.getElementById(ID)?.remove();
  if (mode === "off") return "off";

  // Invert, then dim a little. Media gets the inversion again, which cancels
  // it, so photos are not negatives, plus its own dim. That dim must come
  // before the inner inversion: applied after it, the outer inversion would
  // turn it into lifted blacks instead of darker images. The filter sits on
  // the root element, which the CSS spec exempts from breaking position: fixed.
  const invert = keepHues ? "invert(1) hue-rotate(180deg)" : "invert(1)";
  const page = `html { filter: ${invert} brightness(${dim}) !important; }`;
  const media = `img, picture, video, canvas, object, embed, iframe { filter: brightness(${mediaDim}) ${invert} !important; }`;
  const place = (root, css) => {
    if (root.getElementById(ID)) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = css;
    (root === document ? document.documentElement : root).appendChild(style);
  };
  place(document, page + media);

  const observer = new MutationObserver(() => {
    clearTimeout(globalThis.darkenTimer);
    globalThis.darkenTimer = setTimeout(scan, 200);
  });
  function scan() {
    for (const root of shadowRoots(document)) {
      place(root, media);
      observer.observe(root, { childList: true, subtree: true });
    }
  }
  observer.observe(document.documentElement, { childList: true, subtree: true });
  globalThis.darkenObserver = observer;
  scan();
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
// With FOLLOW_SYSTEM the inversion is tied to the system colour scheme. The
// background page sees the same prefers-color-scheme as web pages do: by
// default the operating system setting, unless a Firefox theme or the
// "Website appearance" setting in Firefox overrides it.
// ---------------------------------------------------------------------------
const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
const active = () => !FOLLOW_SYSTEM || darkMode.matches;

// ---------------------------------------------------------------------------
// Switched-on sites are inverted on every load, before the page is drawn, so
// the effect survives a reload. With FOLLOW_SYSTEM only while the system is
// in dark mode.
// ---------------------------------------------------------------------------
const registrations = new Map(); // origin -> RegisteredContentScript

async function sites() {
  const { sites } = await browser.storage.local.get({ sites: [] });
  return sites;
}

async function register(origin) {
  if (!active() || registrations.has(origin)) return;
  const registration = await browser.contentScripts.register({
    matches: [origin + "/*"],
    js: [{ code: `${code("on")} browser.runtime.sendMessage("inverted");` }],
    runAt: "document_start",
  });
  registrations.set(origin, registration);
}

function unregisterAll() {
  for (const registration of registrations.values()) registration.unregister();
  registrations.clear();
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
    browser.browserAction.setTitle({ tabId: tab.id, title: "Darken this website: not allowed on this page" });
    return;
  }
  if (origin) await (on ? remember(origin) : forget(origin));
  setState(tab.id, result);
}

// Switch a tab that is inverted or restored by the system, not by a click.
// Pages Firefox never lets extensions touch are left alone.
async function run(tabId, mode) {
  try {
    const [result] = await browser.tabs.executeScript(tabId, { code: code(mode), runAt: "document_start" });
    setState(tabId, result);
  } catch (error) {}
}

// The system switched colour scheme. Dark: arm the remembered sites for their
// next load and invert the ones that are open now; discarded tabs are left
// alone, they load inverted. Light: nothing is inverted on load any more and
// every inverted tab is restored; the sites stay remembered.
async function schemeChanged() {
  if (active()) {
    const list = await sites();
    for (const origin of list) await register(origin);
    for (const tab of await browser.tabs.query({ discarded: false })) {
      const origin = originOf(tab);
      if (origin && list.includes(origin) && states.get(tab.id) !== "inverted") await run(tab.id, "on");
    }
  } else {
    unregisterAll();
    for (const [tabId, state] of states) if (state === "inverted") await run(tabId, "off");
  }
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

// Scheme changes are handled one at a time, so a quick back-and-forth ends in
// the state the system is actually in.
if (FOLLOW_SYSTEM) {
  let queue = Promise.resolve();
  darkMode.addEventListener("change", () => { queue = queue.then(schemeChanged); });
}

init();
