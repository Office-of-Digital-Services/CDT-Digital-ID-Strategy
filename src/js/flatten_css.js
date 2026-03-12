(function () {
  const style = document.querySelector("style#cagov-custom");
  if (!style) return;

  const input = style.textContent;

  //
  // Lightweight CSS parser + re-emitter
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
  // Parser → AST
  // ------------------------------
  function parseBlocks(tokens) {
    var root = { selector: "", declarations: [], children: [] };
    var stack = [root];
    var i = 0;

    while (i < tokens.length) {
      var t = tokens[i];

      if (t.type === "text") {
        var text = t.value;

        // If next token is "{", this is a selector
        if (tokens[i + 1] && tokens[i + 1].type === "{") {
          var block = { selector: text, declarations: [], children: [] };
          stack[stack.length - 1].children.push(block);
          stack.push(block);
          i += 2; // skip "{"
        } else {
          // Otherwise it's declarations inside the current block
          var parts = text.split(";");
          for (var p = 0; p < parts.length; p++) {
            var d = parts[p].trim();
            if (d) {
              stack[stack.length - 1].declarations.push(d);
            }
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
  // Emitter (no flattening)
  // ------------------------------
  function emitBlocks(block, indentLevel) {
    var css = "";
    var indent = new Array(indentLevel + 1).join("  ");

    if (block.selector) {
      css += indent + block.selector + " {\n";
    }

    // Declarations
    for (var i = 0; i < block.declarations.length; i++) {
      css += indent + "  " + block.declarations[i] + ";\n";
    }

    // Children
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
  // Public API
  // ------------------------------
  function parseCSS(cssText) {
    return parseBlocks(tokenize(cssText));
  }

  function stringifyCSS(ast) {
    return emitBlocks(ast, 0);
  }

  // ------------------------------
  // Example usage
  // ------------------------------
  // var ast = parseCSS(nestedCSS);
  // console.log(ast);
  // console.log(stringifyCSS(ast));

  const flat = stringifyCSS(parseCSS(input));

  style.textContent = flat;
  flattenOutput.value = flat;
  console.log("POLYFILL: Nested CSS flattened at runtime.");
})();
