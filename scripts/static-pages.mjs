import { cp, mkdir } from "node:fs/promises";

for (const route of ["admin", "privacy", "terms"]) {
  await mkdir(`dist/${route}`, { recursive: true });
  await cp("dist/index.html", `dist/${route}/index.html`);
}

await cp("dist/index.html", "dist/404.html");
