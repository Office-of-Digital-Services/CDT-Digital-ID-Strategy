//@ts-check
const { minify } = require("terser");
const postcss = require("postcss");
const PurgeCSS = require("@fullhuman/postcss-purgecss");

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
      .replace(/ !/g, "!");

  // PurgeCSS filter to extract only used CSS
  eleventyConfig.addFilter(
    "purgeCSS",
    async (
      /** @type {string} */ css,
      contentPaths = [
        "./pages/**/*.html",
        "./src/css/**/*.css",
        "./src/js/**/*.mjs",
        "./src/_includes/**/*.html",
        "./node_modules/@cagovweb/state-template/dist/js/cagov.core.min.js"
      ]
    ) => {
      const result = await postcss([
        // @ts-ignore
        PurgeCSS({
          content: contentPaths,
          safelist: [":focus", /focus/, "focus-visible", "focus-within"],
          defaultExtractor: (/** @type {string} */ content) =>
            content.match(/[\w-/:]+(?<!:)/g) || []
        })
      ]).process(css, { from: undefined });
      // Minify the purged CSS
      return minifyCSS(result.css);
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
