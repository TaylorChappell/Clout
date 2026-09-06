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
  await access(new URL(".nojekyll", output));
});
