module.exports = function (eleventyConfig) {
  return {
    dir: {
      input: ".",
      includes: "src/_includes",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
    templateFormats: ["html", "njk"],
  };
};
