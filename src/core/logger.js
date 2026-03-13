function nowIso() {
  return new Date().toISOString();
}

function maskSecrets(text) {
  if (!text) {
    return text;
  }
  return String(text)
    .replace(/client_secret=[^&\s]+/gi, "client_secret=***")
    .replace(/Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/gi, "Authorization: Bearer ***");
}

function log(level, message, meta) {
  const payload = {
    ts: nowIso(),
    level,
    message,
    ...(meta ? { meta } : {})
  };
  const safe = maskSecrets(JSON.stringify(payload));
  process.stdout.write(`${safe}\n`);
}

module.exports = {
  info: (message, meta) => log("INFO", message, meta),
  warn: (message, meta) => log("WARN", message, meta),
  error: (message, meta) => log("ERROR", message, meta)
};
