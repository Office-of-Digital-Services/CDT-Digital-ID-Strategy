// _data/cssBundle.js
const fs = require("node:fs");
const path = require("node:path");

module.exports = function () {
  const dir = "src/accessCA/css";
  const nodeModuleCss = path.resolve(
    __dirname,
    "../../node_modules/@cagovweb/state-template/dist/css/cagov.core.css"
  );

  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".css"))
    .map(f => fs.readFileSync(path.join(dir, f), "utf8"));

  // Read the node_modules CSS file
  let externalCss = "";
  if (fs.existsSync(nodeModuleCss)) {
    externalCss = fs
      .readFileSync(nodeModuleCss, "utf8")
      .replace(/\s+!default(?=\s*;)/g, "");
  }

  return [externalCss, ...files].join("\n");
};
