// @ts-check
(function () {
  if (!CSS.supports("selector(&)")) {
    // hide broken content until styles are flattened
    document.documentElement.style.visibility = "hidden";

    const script = document.createElement("script");
    script.src = "/js/flatten_css.js";
    document.head.appendChild(script);
  }
})();
