//@ts-check
const { minify } = require("terser");
const { PurgeCSS } = require("purgecss");

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

  /**
   * @param {string} content
   */
  const minifyCSS = content =>
    content
      .replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, "")
      .replace(/ {2,}/g, " ")
      .replace(/ ([{:}]) /g, "$1")
      .replace(/([{:}]) /g, "$1")
      .replace(/([;,]) /g, "$1")
      .replace(/ !/g, "!")
      .replace(
        /calc\(\s*([^)]+?)\s*\)/g,
        (match, inner) =>
          "calc(" +
          inner.replace(/\s*\+\s*/g, "+").replace(/\s*-\s*/g, "-") +
          ")"
      );

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
      //return purge[0].css;
      return minifyCSS(purge[0].css);
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
      callback(null, minifyCSS(code));
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

  // canonical shortcode
  // Usage <link href="{% canonical %}" rel="canonical" />
  eleventyConfig.addShortcode(
    "canonical",
    /** @type {  (this: { ctx: { page: { url: string } } }) => string} */ function () {
      return domain + this.ctx.page.url;
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
