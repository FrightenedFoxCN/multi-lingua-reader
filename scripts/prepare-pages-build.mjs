import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(projectRoot, "dist/client");
const pagesBasePath = "/multi-lingua-reader";
const prefixedAssets = resolve(
  outputDirectory,
  pagesBasePath.slice(1),
  "_next",
);
const rootAssets = resolve(outputDirectory, "_next");
const generatedPages = [
  "index.html",
  "docs.html",
  "sources.html",
];

for (const relativePath of generatedPages) {
  const outputPath = resolve(outputDirectory, relativePath);
  if (!existsSync(outputPath)) {
    throw new Error(`GitHub Pages build is missing ${relativePath}`);
  }
}

for (const route of ["docs", "sources"]) {
  const routeDirectory = resolve(outputDirectory, route);
  mkdirSync(routeDirectory, { recursive: true });
  copyFileSync(
    resolve(outputDirectory, `${route}.html`),
    resolve(routeDirectory, "index.html"),
  );
}

if (!existsSync(resolve(outputDirectory, "404.html"))) {
  copyFileSync(
    resolve(outputDirectory, "index.html"),
    resolve(outputDirectory, "404.html"),
  );
}

if (!existsSync(prefixedAssets)) {
  throw new Error(`GitHub Pages build is missing ${pagesBasePath}/_next`);
}
cpSync(prefixedAssets, rootAssets, { recursive: true });

const indexHtml = readFileSync(resolve(outputDirectory, "index.html"), "utf8");
if (!indexHtml.includes(`${pagesBasePath}/`)) {
  throw new Error(`GitHub Pages build does not contain the ${pagesBasePath} base path`);
}

writeFileSync(resolve(outputDirectory, ".nojekyll"), "");

console.log("GitHub Pages artifact ready: dist/client");
