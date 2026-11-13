// Applies the saved theme before first paint to avoid a light/dark flash.
// Kept as a separate file so a strict Content-Security-Policy can block inline scripts.
(function () {
  try {
    var t = JSON.parse(localStorage.getItem("bm_theme") || "{}");
    var mode = t.mode || "system";
    var dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    var el = document.documentElement;
    el.dataset.theme = dark ? "dark" : "light";
    el.dataset.accent = t.accent || "violet";
    el.dataset.preset = t.preset || "default";
    el.dataset.density = t.density || "comfortable";
  } catch {
    /* storage unavailable: defaults apply */
  }
})();
