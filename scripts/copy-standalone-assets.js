// copies .next/static and public/ into .next/standalone/ so the standalone
// server can serve CSS, JS chunks, and public assets without a CDN
const { existsSync, cpSync, mkdirSync } = require("fs");
const { join, dirname } = require("path");

const root = join(__dirname, "..");

const staticSrc = join(root, ".next", "static");
const staticDst = join(root, ".next", "standalone", ".next", "static");
if (existsSync(staticSrc)) {
  mkdirSync(dirname(staticDst), { recursive: true });
  cpSync(staticSrc, staticDst, { recursive: true });
  console.log("copied .next/static → standalone");
}

const publicSrc = join(root, "public");
const publicDst = join(root, ".next", "standalone", "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDst, { recursive: true });
  console.log("copied public/ → standalone");
}
