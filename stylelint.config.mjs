/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "selector-class-pattern": null,
    "nesting-selector-no-missing-scoping-root": true,
    "color-no-invalid-hex": true,
    "selector-nested-pattern": [
      "^(?:&(?!\\s*>)|[^a-zA-Z0-9])",
      {
        message:
          "Safari 16.5 compatibility: nested selectors must start with '&' (not '& >') or any non-alphanumeric symbol."
      }
    ]
  }
};
