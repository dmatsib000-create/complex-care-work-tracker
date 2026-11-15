// Lint: only names that are used but never defined, or defined but never used. No style rules, so the
// settings block and the rest of tracker.html stay as they are. Run with `npm run lint` (also run on GitHub).
const html = require("eslint-plugin-html");
const globals = require("globals");

const rules = { "no-undef": "error", "no-unused-vars": ["error", { caughtErrors: "none" }] };

module.exports = [
  {
    // The page's script, read out of tracker.html. It runs as a classic browser script.
    files: ["tracker.html"],
    plugins: { html },
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: globals.browser },
    rules,
  },
  {
    files: ["eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: globals.node },
    rules,
  },
  {
    // The tests run in Node, but the functions they pass to page.evaluate run inside the tracker page,
    // where the browser's names and the page's own functions are defined.
    files: ["tests/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs",
      globals: { ...globals.node, ...globals.browser,
        ...Object.fromEntries(["TAXONOMY", "computeReport", "summaryText", "listUnit", "computeTeam", "teamSummaryText", "render"]
          .map((name) => [name, "readonly"])) } },
    rules,
  },
];
