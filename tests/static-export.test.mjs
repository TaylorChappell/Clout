import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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
