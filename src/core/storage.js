const fs = require("fs");
const path = require("path");

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function cleanupOldReports(outputDir, retentionDays) {
  const now = Date.now();
  const threshold = now - retentionDays * 24 * 60 * 60 * 1000;

  const files = fs.readdirSync(outputDir);
  for (const file of files) {
    if (!/^report-\d{8}\.html$/.test(file)) {
      continue;
    }
    const fullPath = path.join(outputDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < threshold) {
      fs.unlinkSync(fullPath);
    }
  }
}

module.exports = {
  writeJson,
  readJsonIfExists,
  cleanupOldReports
};
