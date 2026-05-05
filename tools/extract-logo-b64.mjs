import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, "..", "app", "src", "main", "assets", "www", "index.html");
const text = fs.readFileSync(indexPath, "utf8");
const m = text.match(/const BLC_LOGO_SRC = "data:image\/png;base64,([^"]+)"/);
if (!m) {
  console.error("BLC_LOGO_SRC not found");
  process.exit(1);
}
const out = path.join(__dirname, "tmp_blc_logo.png");
fs.writeFileSync(out, Buffer.from(m[1], "base64"));
console.log("Wrote", out);
