// _data/cssBundle.js
const fs = require("node:fs");
const path = require("node:path");

module.exports = function () {
  const dir = "src/css";

  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".css"))
    .map(f => fs.readFileSync(path.join(dir, f), "utf8"));

  return files.join("\n");
};
