// Click the icon to invert the active tab; click again to restore it.
// The filter goes on the root element, not on body: a filtered body becomes
// the containing block for position: fixed, so sticky headers and menus would
// scroll away with the page. Images, video and frames get the same filter a
// second time, which cancels it, so photos are not shown as negatives.
browser.browserAction.onClicked.addListener((tab) => {
  browser.tabs.executeScript({
    code: `(() => {
      const ID = "invert-colors-style";
      const existing = document.getElementById(ID);
      if (existing) { existing.remove(); return; }
      const f = "invert(1) hue-rotate(180deg)";
      const style = document.createElement("style");
      style.id = ID;
      style.textContent = "html { filter: " + f + " !important; } img, picture, video, canvas, object, embed, iframe { filter: " + f + " !important; }";
      document.documentElement.appendChild(style);
    })();`
  });
});
