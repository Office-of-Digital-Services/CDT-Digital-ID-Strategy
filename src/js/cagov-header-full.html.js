//@ts-check
document.addEventListener("DOMContentLoaded", () => {
  if (!CSS.supports("selector(&)")) {
    //console.log("POLYFILL: CSS Nesting not supported. Loading polyfill…");

    const script = document.createElement("script");
    script.src = "/js/flatten_css.js";
    script.defer = true;
    document.head.appendChild(script);
  }
});
