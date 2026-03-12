//@ts-check
document.addEventListener("DOMContentLoaded", () => {
  // Polyfill to support grouping <details> elements via the NAME property.
  // Safaroi 16.5 and earlier do not support details.name

  // Test to see if browser supports details.name
  const test = document.createElement("details");
  test.setAttribute("name", "x");
  const supportsName = test.name === "x";

  if (!supportsName) {
    /**
     * Selects all <details> elements that have a NAME attribute.
     * @type {NodeListOf<HTMLDetailsElement>}
     */
    const accordions = document.querySelectorAll("details[name]");
    accordions.forEach(details => {
      details.addEventListener("toggle", () => {
        if (details.open) {
          accordions.forEach(other => {
            if (
              other.open &&
              other !== details &&
              other.getAttribute("name") === details.getAttribute("name")
            ) {
              other.open = false;
              console.log("POLYFILL: details.name closed");
            }
          });
        }
      });
    });
  }
  // End details.name polyfill

 // if (!CSS.supports("selector(&)")) {
    console.log("POLYFILL: CSS Nesting not supported. Loading polyfill…");

    const script = document.createElement("script");
    script.src = "/js/flatten_css.js";
    script.defer = true;
    document.head.appendChild(script);

 // }
});


