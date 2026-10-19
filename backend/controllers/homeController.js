// controllers/homeController.js
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

function renderHome(req, res) {
  res.sendFile(path.join(__dirname, "..", "public", "home", "home.html"));
}

export default { renderHome };
