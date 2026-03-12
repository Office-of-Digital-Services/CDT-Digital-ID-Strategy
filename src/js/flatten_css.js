//@ts-check
(function () {
  //
  // CSS parser + media-aware AST + flattener
  // Safari 13.1 compatible
  //

  /**
   * @typedef CSSToken
   * @property {string} type
   * @property {string} [value]
   */

  /**
   * Tokenizer
   * @param {string} css
   */
  function tokenize(css) {
    /** @type {CSSToken[]} */
    var tokens = [];
    var buf = "";
    var i, c;

    for (i = 0; i < css.length; i++) {
      c = css[i];

      if (c === "{" || c === "}") {
        if (buf.trim()) {
          tokens.push({ type: "text", value: buf.trim() });
        }
        tokens.push({ type: c });
        buf = "";
      } else {
        buf += c;
      }
    }

    if (buf.trim()) {
      tokens.push({ type: "text", value: buf.trim() });
    }

    return tokens;
  }

  /**
   * Declaration splitter (semicolon-based)
   * @param {string} text
   */
  function splitDeclarations(text) {
    var out = [];
    var buf = "";
    var i, c;

    for (i = 0; i < text.length; i++) {
      c = text[i];

      if (c === ";") {
        if (buf.trim()) out.push(buf.trim());
        buf = "";
      } else {
        buf += c;
      }
    }

    if (buf.trim()) out.push(buf.trim());

    return out;
  }

  /**
   * parser → AST
   * @param {CSSToken[]} tokens
   */
  function parseBlocks(tokens) {
    /** @type {CSSNode} */
    var root = { type: "root", selector: "", declarations: [], children: [] };
    var stack = [root];
    var i = 0;

    while (i < tokens.length) {
      var t = tokens[i];

      if (t.type === "text") {
        var text = t.value || "";

        if (tokens[i + 1] && tokens[i + 1].type === "{") {
          // Text before "{" may contain declarations + a nested selector.
          // Example:
          //   box-sizing: border-box;
          //   color: #333;
          //   :focus
          var lastSemi = text.lastIndexOf(";");
          var selectorText = text;

          if (lastSemi !== -1) {
            var before = text.slice(0, lastSemi + 1);
            var after = text.slice(lastSemi + 1);

            var decls = splitDeclarations(before);
            for (var d = 0; d < decls.length; d++) {
              stack[stack.length - 1].declarations?.push(decls[d]);
            }

            selectorText = after.trim();
          }

          var isMedia = selectorText.indexOf("@media") === 0;

          /** @type {CSSNode} */
          var block = {
            type: isMedia ? "media" : "rule",
            selector: selectorText,
            declarations: [],
            children: []
          };

          stack[stack.length - 1]?.children?.push(block);
          stack.push(block);
          i += 2; // skip "{"
        } else {
          // Pure declarations inside current block
          var decls2 = splitDeclarations(text);
          for (var p = 0; p < decls2.length; p++) {
            stack[stack.length - 1]?.declarations?.push(decls2[p]);
          }
          i++;
        }
      } else if (t.type === "}") {
        stack.pop();
        i++;
      } else {
        i++;
      }
    }

    return root;
  }

  /**
   * Selector utilities
   * @param {string} sel
   */
  function splitSelectors(sel) {
    var parts = sel.split(",");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i].trim();
      if (s) out.push(s);
    }
    return out;
  }

  /**
   * Combines parent selectors with child selector, handling "&" references.
   * @param {string[]} parentList
   * @param {string} childSel
   */
  function expandSelectors(parentList, childSel) {
    if (!childSel) return parentList;

    var childList = splitSelectors(childSel);
    var result = [];
    var i, j;

    for (i = 0; i < parentList.length; i++) {
      var parent = parentList[i];

      for (j = 0; j < childList.length; j++) {
        var child = childList[j];
        var combined;

        if (child.indexOf("&") !== -1) {
          combined = child.replace(/&/g, parent);
        } else if (parent) {
          combined = parent + " " + child;
        } else {
          combined = child;
        }

        result.push(combined);
      }
    }

    return result;
  }

  /**
   * Normalizes media queries to a standard form.
   * E.g. converts "(width >= 576px)" to "(min-width: 576px)"
   * @param {string} q
   */
  function normalizeMediaQuery(q) {
    const m = q.match(/^@media\s*\(([^)]+)\)\s*$/);
    if (!m) return q;

    const cond = m[1].trim();
    const patterns = [
      {
        re: /^width\s*>=\s*(\d+)px$/,
        fn: (/** @type {string} */ v) => `@media (min-width: ${v}px)`
      },
      {
        re: /^width\s*>\s*(\d+)px$/,
        fn: (/** @type {string} */ v) =>
          `@media (min-width: ${parseInt(v, 10) + 1}px)`
      },
      {
        re: /^width\s*<=\s*(\d+)px$/,
        fn: (/** @type {string} */ v) => `@media (max-width: ${v}px)`
      },
      {
        re: /^width\s*<\s*(\d+)px$/,
        fn: (/** @type {string} */ v) =>
          `@media (max-width: ${parseInt(v, 10) - 1}px)`
      }
    ];

    for (const { re, fn } of patterns) {
      const match = cond.match(re);
      if (match) return fn(match[1]);
    }

    return q;
  }

  /**
   * @typedef CSSNode
   * @property {"root" | "rule" | "media"} [type]
   * @property {string} [media]
   * @property {string} [selector]
   * @property {string[]} [selectors]
   * @property {string[]} [declarations]
   * @property {CSSNode[]} [children]
   */

  /**
   * Collects flat rules from the AST, combining selectors and media queries.
   *
   * @param {CSSNode} node - Current AST node
   * @param {string[]} parentSelectors - List of parent selectors
   * @param {CSSNode[]} out - Accumulator for flat rules
   * @param {string} [mediaSelector] - Current media query context
   */
  function collectFlatRules(node, parentSelectors, out, mediaSelector) {
    if (!parentSelectors) parentSelectors = [""];

    if (node.type === "rule") {
      var selectors = parentSelectors;

      if (node.selector) {
        selectors = expandSelectors(parentSelectors, node.selector);
      }

      if (node.declarations?.length) {
        out.push({
          selectors: selectors,
          media: mediaSelector,
          declarations: node.declarations.slice()
        });
      }

      node.children?.forEach(child => {
        collectFlatRules(child, selectors, out, mediaSelector);
      });
    } else if (node.type === "media") {
      var newMedia = normalizeMediaQuery(node.selector || ""); // e.g. "@media (min-width: 992px)"

      if (node.declarations?.length && node.selector) {
        out.push({
          selectors: parentSelectors,
          media: newMedia,
          declarations: node.declarations.slice()
        });
      }

      node.children?.forEach(child => {
        collectFlatRules(child, parentSelectors, out, newMedia);
      });
    } else if (node.type === "root") {
      node.children?.forEach(child => {
        collectFlatRules(child, parentSelectors, out, mediaSelector);
      });
    }
  }

  // ------------------------------
  // Flattened emitter
  // ------------------------------

  /**
   * Emits flattened CSS from flat rules.
   * @param {CSSNode[]} rules
   */
  function emitFlatCSS(rules) {
    let css = "";

    /** @type {Object<string, CSSNode[]>} */
    const byMedia = {};
    rules.forEach(r => {
      var key = r.media || "__no_media__";
      if (!byMedia[key]) byMedia[key] = [];
      byMedia[key].push(r);
    });

    const mediaKeys = Object.keys(byMedia);

    for (const mediaKey of mediaKeys) {
      const group = byMedia[mediaKey];
      const isNoMedia = mediaKey === "__no_media__";

      if (!isNoMedia) css += mediaKey + " {\n";

      for (const rule of group) {
        for (const sel of rule.selectors || []) {
          css += sel + " {\n";
          for (const decl of rule.declarations || []) {
            css += decl + ";\n";
          }
          css += "}\n\n";
        }
      }

      if (!isNoMedia) css += "}\n\n";
    }

    return css;
  }

  // ------------------------------
  // Public API
  // ------------------------------
  /**
   * @param {string} cssText
   */
  function parseCSS(cssText) {
    return parseBlocks(tokenize(cssText));
  }

  /**
   * @param {string} cssText
   */
  function flattenCSS(cssText) {
    var ast = parseCSS(cssText);
    /** @type {CSSNode[]} */
    var rules = [];
    collectFlatRules(ast, [""], rules);
    return emitFlatCSS(rules);
  }

  const styles = document.querySelectorAll("style");
  styles.forEach(style => {
    const input = style.textContent;

    const flat = flattenCSS(input);

    style.textContent = flat;
    console.log("POLYFILL: Nested CSS flattened at runtime.");
  });

  document.documentElement.style.visibility = "";
})();
