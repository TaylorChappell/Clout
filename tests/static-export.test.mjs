import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const output = new URL("../dist/", import.meta.url);

test("exports every public route", async () => {
  for (const route of ["index.html", "admin/index.html", "terms/index.html", "privacy/index.html"]) {
    await access(new URL(route, output));
  }
});

test("exports CLOUT branding and GitHub Pages marker", async () => {
  const html = await readFile(new URL("index.html", output), "utf8");
  assert.match(html, /CLOUT Studios/i);
  assert.doesNotMatch(html, /src\/main\.tsx/);
  assert.match(html, /assets\/.*\.js/);
  await access(new URL(".nojekyll", output));
});

test("relative builds resolve nested-route assets from the site root", async () => {
  const rootHtml = await readFile(new URL("index.html", output), "utf8");
  const adminHtml = await readFile(new URL("admin/index.html", output), "utf8");

  if (rootHtml.includes('src="./assets/')) {
    const basePosition = adminHtml.indexOf('<base href="../">');
    const firstRelativeAsset = Math.min(
      ...[adminHtml.indexOf('href="./'), adminHtml.indexOf('src="./')].filter((position) => position >= 0),
    );

    assert.ok(basePosition >= 0, "nested routes must define a base URL");
    assert.ok(basePosition < firstRelativeAsset, "the base URL must precede relative asset references");
  }
});

test("ships the wallet logos and current CLOUT content", async () => {
  for (const asset of ["eth.png", "robinhood.png", "metamask.png"]) {
    await access(new URL(asset, output));
  }

  const builtFiles = await readdir(new URL("assets/", output));
  const entryFile = builtFiles.find((name) => /^index-.*\.js$/.test(name));
  assert.ok(entryFile, "the compiled entry script must exist");
  const javascript = await readFile(new URL(`assets/${entryFile}`, output), "utf8");

  assert.match(javascript, /150K\+ visits/);
  assert.match(javascript, /https:\/\/x\.com\/CLOUT_robinhood/);
  assert.match(javascript, /metamask\.png/);
  assert.doesNotMatch(javascript, /CLOUT is coming to Robinhood|Built for Robinhood|Non-custodial sign-in/);
});
