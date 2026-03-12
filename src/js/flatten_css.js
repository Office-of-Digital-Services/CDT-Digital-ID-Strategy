(function () {
  //
  // CSS parser + media-aware AST + flattener
  // Safari 13.1 compatible
  //

  // ------------------------------
  // Tokenizer
  // ------------------------------
  function tokenize(css) {
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

  // ------------------------------
  // Declaration splitter (semicolon-based)
  // ------------------------------
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

  // ------------------------------
  // Parser → AST
  // ------------------------------
  function parseBlocks(tokens) {
    var root = { type: "root", selector: "", declarations: [], children: [] };
    var stack = [root];
    var i = 0;

    while (i < tokens.length) {
      var t = tokens[i];

      if (t.type === "text") {
        var text = t.value;

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
              stack[stack.length - 1].declarations.push(decls[d]);
            }

            selectorText = after.trim();
          }

          var isMedia = selectorText.indexOf("@media") === 0;

          var block = {
            type: isMedia ? "media" : "rule",
            selector: selectorText,
            declarations: [],
            children: []
          };

          stack[stack.length - 1].children.push(block);
          stack.push(block);
          i += 2; // skip "{"
        } else {
          // Pure declarations inside current block
          var decls2 = splitDeclarations(text);
          for (var p = 0; p < decls2.length; p++) {
            stack[stack.length - 1].declarations.push(decls2[p]);
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

  // ------------------------------
  // Round-trip emitter (no flattening)
  // ------------------------------
  function emitBlocks(block, indentLevel) {
    var css = "";
    var indent = new Array(indentLevel + 1).join("  ");

    if (block.selector) {
      css += indent + block.selector + " {\n";
    }

    for (var i = 0; i < block.declarations.length; i++) {
      css += indent + "  " + block.declarations[i] + ";\n";
    }

    for (var j = 0; j < block.children.length; j++) {
      css += emitBlocks(
        block.children[j],
        indentLevel + (block.selector ? 1 : 0)
      );
    }

    if (block.selector) {
      css += indent + "}\n";
    }

    return css;
  }

  // ------------------------------
  // Selector utilities
  // ------------------------------
  function splitSelectors(sel) {
    var parts = sel.split(",");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i].trim();
      if (s) out.push(s);
    }
    return out;
  }

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

  // ------------------------------
  // Flattening traversal
  // ------------------------------
  function collectFlatRules(node, parentSelectors, mediaSelector, out) {
    if (!parentSelectors) parentSelectors = [""];

    if (node.type === "rule") {
      var selectors = parentSelectors;

      if (node.selector) {
        selectors = expandSelectors(parentSelectors, node.selector);
      }

      if (node.declarations.length) {
        out.push({
          selectors: selectors,
          media: mediaSelector,
          declarations: node.declarations.slice()
        });
      }

      for (var i = 0; i < node.children.length; i++) {
        collectFlatRules(node.children[i], selectors, mediaSelector, out);
      }
    } else if (node.type === "media") {
      var newMedia = node.selector; // e.g. "@media (width >= 992px)"

      if (node.declarations.length) {
        out.push({
          selectors: parentSelectors,
          media: newMedia,
          declarations: node.declarations.slice()
        });
      }

      for (var j = 0; j < node.children.length; j++) {
        collectFlatRules(node.children[j], parentSelectors, newMedia, out);
      }
    } else if (node.type === "root") {
      for (var k = 0; k < node.children.length; k++) {
        collectFlatRules(node.children[k], parentSelectors, mediaSelector, out);
      }
    }
  }

  // ------------------------------
  // Flattened emitter
  // ------------------------------
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
  function parseCSS(cssText) {
    cssText = stripComments(cssText);
    return parseBlocks(tokenize(cssText));
  }

  function flattenCSS(cssText) {
    var ast = parseCSS(cssText);
    var rules = [];
    collectFlatRules(ast, [""], null, rules);
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
  flattenOutput.value = flat;
  console.log("POLYFILL: Nested CSS flattened at runtime.");
})();
