import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const indexHtml = await readFile("dist/index.html", "utf8");
const relativeBuild = indexHtml.includes('src="./assets/');

for (const route of ["admin", "privacy", "terms"]) {
  await mkdir(`dist/${route}`, { recursive: true });
  const routeHtml = indexHtml
    .replace('window.CLOUT_ROUTE = "/";', `window.CLOUT_ROUTE = "/${route}";`)
    .replace("<head>", `<head>${relativeBuild ? '\n    <base href="../">' : ""}`);
  await writeFile(`dist/${route}/index.html`, routeHtml);
}

await cp("dist/index.html", "dist/404.html");
