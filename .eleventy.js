module.exports = function (eleventyConfig) {
  // Passthrough copy for static assets
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy({
    "src/root": "."
  });
  eleventyConfig.addPassthroughCopy({
    "src/docs": "."
  });
  // Add more passthroughs if needed (e.g., fonts, js)
  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site"
    },
    htmlTemplateEngine: "njk",
    templateFormats: ["html", "njk"]
  };
};
