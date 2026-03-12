// @ts-check
(function () {
  if (!CSS.supports("selector(&)")) {
    // Inject safeload CSS immediately before first paint
    const style = document.createElement("style");
    style.textContent = `html>body{visibility:hidden}html{>body{visibility:visible}}`;
    document.head.appendChild(style);

    const script = document.createElement("script");
    script.src = "/js/flatten_css.js";
    document.head.appendChild(script);
  }
})();
