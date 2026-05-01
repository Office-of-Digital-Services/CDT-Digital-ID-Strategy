//@ts-check
const { minify } = require("terser");
const { PurgeCSS } = require("purgecss");
const { transform } = require("lightningcss");

/**
 * @typedef {import("./node_modules/@11ty/eleventy/src/defaultConfig.js").defaultConfig} EleventyDefaultConfig
 * @typedef {import("@11ty/eleventy/UserConfig").default} EleventyConfig
 */

module.exports = async function (
  /** @type {EleventyConfig} **/ eleventyConfig
) {
  const domain = "https://www.digitalidstrategy.cdt.ca.gov";

  eleventyConfig.addGlobalData("layout", "base-layout");

  eleventyConfig.addPassthroughCopy({
    "src/images": "images",
    "src/root": "/",
    "src/fonts": "fonts"
  });

  eleventyConfig.addWatchTarget("./src");

  // PurgeCSS filter to extract only used CSS
  eleventyConfig.addFilter(
    "purgeCSS",
    async function purgeCSS(
      /** @type {string} */ css,
      /** @type {string} */ html
    ) {
      const purge = await new PurgeCSS().purge({
        content: [
          {
            raw: "<html><body>" + html + "</body></html>",
            extension: "html"
          }
        ],
        css: [
          {
            raw: css
          }
        ],
        safelist: [
          ":focus",
          ":hover",
          /focus/,
          "focus-visible",
          "focus-within",
          ":first-child",
          ":last-child"
        ],
        defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
      });
      return purge[0].css;
    }
  );

  eleventyConfig.addNunjucksAsyncFilter(
    "cssmin",
    /**
     *
     * @param {string} code
     * @param {(arg0: null, arg1: string) => void} callback
     */
    async (code, callback) => {
      try {
        const { code: minifiedCode } = transform({
          filename: "style.css",
          code: Buffer.from(code),
          minify: true,
          sourceMap: false
        });
        callback(null, minifiedCode.toString());
      } catch (err) {
        console.error("Lightning CSS error:", err);
        callback(null, code);
      }
    }
  );

  eleventyConfig.addNunjucksAsyncFilter(
    "jsmin",
    /**
     *
     * @param {string} code
     * @param {(arg0: null, arg1: string) => void} callback
     */
    async (code, callback) => {
      const minified = await minify(code);
      callback(null, minified.code || "");
    }
  );

  /**
   * Wraps content in a specified HTML tag with optional attributes.
   */
  eleventyConfig.addFilter(
    "wrapTag",
    function (
      /** @type {string} */ content,
      /** @type {string} */ tagName,
      /** @type {string} */ attributes = ""
    ) {
      const attrs = attributes.trim() ? " " + attributes.trim() : "";
      return `<${tagName}${attrs}>${content}</${tagName}>`;
    }
  );

  //Start with default config, easier to configure 11ty later
  /** @type {EleventyDefaultConfig} */
  const config = {
    // allow nunjucks templating in .html files
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["html", "njk", "11ty.js", "md"],
    keys: {},
    dir: {
      // site content pages
      input: "pages"
    }
  };

  return config;
};
