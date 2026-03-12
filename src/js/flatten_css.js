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
    // Input: "@media (width >= 576px)"
    // Output: "@media (min-width: 576px)"

    // Extract the condition inside @media (...)
    var m = q.match(/^@media\s*\(([^)]+)\)\s*$/);
    if (!m) return q; // not a simple media query

    var cond = m[1].trim();

    // >=  → min-width
    var gte = cond.match(/^width\s*>=\s*(\d+)px$/);
    if (gte) {
      return "@media (min-width: " + gte[1] + "px)";
    }

    // >  → min-width (value + 1)
    var gt = cond.match(/^width\s*>\s*(\d+)px$/);
    if (gt) {
      var v = parseInt(gt[1], 10) + 1;
      return "@media (min-width: " + v + "px)";
    }

    // <=  → max-width
    var lte = cond.match(/^width\s*<=\s*(\d+)px$/);
    if (lte) {
      return "@media (max-width: " + lte[1] + "px)";
    }

    // <  → max-width (value - 1)
    var lt = cond.match(/^width\s*<\s*(\d+)px$/);
    if (lt) {
      var v2 = parseInt(lt[1], 10) - 1;
      return "@media (max-width: " + v2 + "px)";
    }

    // If it’s already classic syntax or something else, leave it alone
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
   * @typedef {Object} FlatCSSRule
   * @property {string[]} selectors
   * @property {string|null} media
   * @property {string[]} declarations
   */

  /**
   * Emits flattened CSS from flat rules.
   * @param {CSSNode[]} rules
   */
  function emitFlatCSS(rules) {
    var css = "";
    var i, j, k;

    var byMedia = {};
    for (i = 0; i < rules.length; i++) {
      var r = rules[i];
      var key = r.media || "__no_media__";
      if (!byMedia[key]) byMedia[key] = [];
      byMedia[key].push(r);
    }

    var mediaKeys = [];
    for (var m in byMedia) {
      if (byMedia.hasOwnProperty(m)) mediaKeys.push(m);
    }

    for (i = 0; i < mediaKeys.length; i++) {
      var mediaKey = mediaKeys[i];
      var group = byMedia[mediaKey];

      if (mediaKey === "__no_media__") {
        for (j = 0; j < group.length; j++) {
          var rule = group[j];
          for (k = 0; k < rule.selectors.length; k++) {
            css += rule.selectors[k] + " {\n";
            for (var d = 0; d < rule.declarations.length; d++) {
              css += "  " + rule.declarations[d] + ";\n";
            }
            css += "}\n\n";
          }
        }
      } else {
        css += mediaKey + " {\n";
        for (j = 0; j < group.length; j++) {
          var mrule = group[j];
          for (k = 0; k < mrule.selectors.length; k++) {
            css += "  " + mrule.selectors[k] + " {\n";
            for (var md = 0; md < mrule.declarations.length; md++) {
              css += "    " + mrule.declarations[md] + ";\n";
            }
            css += "  }\n\n";
          }
        }
        css += "}\n\n";
      }
    }

    return css;
  }

  /**
   * Strips comments from CSS text.
   * @param {string} css
   */
  function stripComments(css) {
    var out = "";
    var i = 0;
    var inside = false;

    while (i < css.length) {
      // Detect start of comment
      if (!inside && css[i] === "/" && css[i + 1] === "*") {
        inside = true;
        i += 2;
        continue;
      }

      // Detect end of comment
      if (inside && css[i] === "*" && css[i + 1] === "/") {
        inside = false;
        i += 2;
        continue;
      }

      // Copy characters only when not inside a comment
      if (!inside) out += css[i];

      i++;
    }

    return out;
  }

  // ------------------------------
  // Public API
  // ------------------------------
  /**
   * @param {string} cssText
   */
  function parseCSS(cssText) {
    return parseBlocks(tokenize(stripComments(cssText)));
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

  // ------------------------------
  // Example usage
  // ------------------------------
  // var ast = parseCSS(nestedCSS);
  // console.log(stringifyCSS(ast)); // nested, normalized
  // console.log(flattenCSS(nestedCSS)); // flattened CSS

  const style = document.querySelector("style#cagov-custom");
  if (!style) return;

  const input = style.textContent;

  //const flat = input;
  const flat = flattenCSS(input);

  style.textContent = flat;
  console.log("POLYFILL: Nested CSS flattened at runtime.");
})();
