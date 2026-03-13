const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

function readInt(name, fallback) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveServiceKeyCredentials(raw, sourceLabel = "service key") {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid ${sourceLabel}: expected a JSON object`);
  }

  // Support multiple SAP service key shapes: flat, uaa nested, oauth nested
  const uaa = raw.uaa || raw.oauth || raw;

  const tokenUrl = uaa.tokenurl || (uaa.url && `${uaa.url}/oauth/token`);
  const clientId = uaa.clientid;
  const clientSecret = uaa.clientsecret;
  const cpiBaseUrl =
    raw.url ||
    raw.baseUrl ||
    raw.cpiUrl ||
    raw.cpi_base_url ||
    (raw.endpoints && (raw.endpoints.cpi || raw.endpoints.runtime || raw.endpoints.integrationFlow));

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(
      `${sourceLabel} is missing required fields: tokenurl/clientid/clientsecret`
    );
  }

  return { tokenUrl, clientId, clientSecret, cpiBaseUrl: cpiBaseUrl || null };
}

/**
 * Loads SAP credentials from a service key JSON file (raw export from SAP BTP cockpit).
 * Supported formats:
 *   - { url, tokenurl, clientid, clientsecret }            (OAuth2 client credentials)
 *   - { uaa: { url, clientid, clientsecret }, url }         (XSUAA nested)
 * Returns null if no path is configured or the file does not exist.
 */
function loadServiceKeyCredentials() {
  const keyPath = process.env.SAP_SERVICE_KEY_PATH;
  if (!keyPath) {
    return null;
  }

  const resolved = path.resolve(keyPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`SAP_SERVICE_KEY_PATH points to a non-existent file: ${resolved}`);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (parseError) {
    throw new Error(`Failed to parse service key JSON at ${resolved}: ${parseError.message}`);
  }

  return resolveServiceKeyCredentials(raw, `Service key JSON at ${resolved}`);
}

function createConfigFromServiceKeyObject(serviceKey, options = {}) {
  const sk = resolveServiceKeyCredentials(serviceKey, "Provided service key");
  const outputDir = path.resolve(options.outputDir || process.env.OUTPUT_DIR || "./output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cpiBaseUrl = options.cpiBaseUrl || sk.cpiBaseUrl;
  if (!cpiBaseUrl) {
    throw new Error("Service key does not contain CPI base URL (url/baseUrl/cpiUrl)");
  }

  return {
    sap: {
      authMode: "oauth",
      tokenUrl: sk.tokenUrl,
      clientId: sk.clientId,
      clientSecret: sk.clientSecret,
      basicUsername: "",
      basicPassword: "",
      cpiBaseUrl,
      timeoutMs: Number.isFinite(options.timeoutMs) ? options.timeoutMs : readInt("SAP_API_TIMEOUT_MS", 30000),
      maxRetries: Number.isFinite(options.maxRetries) ? options.maxRetries : readInt("SAP_API_MAX_RETRIES", 3),
      pageSize: Number.isFinite(options.pageSize) ? options.pageSize : readInt("SAP_API_PAGE_SIZE", 100)
    },
    output: {
      outputDir,
      retentionDays: readInt("RETENTION_DAYS", 90)
    },
    scheduler: {
      cronExpression: process.env.CRON_EXPRESSION || "0 30 2 * * *",
      timezone: process.env.TIMEZONE || "Europe/Rome"
    },
    alert: {
      webhookUrl: "",
      emailTo: ""
    }
  };
}

function loadConfig() {
  const sk = loadServiceKeyCredentials();
  const basicUsername = process.env.SAP_BASIC_USERNAME || (sk && sk.clientId) || "";
  const basicPassword = process.env.SAP_BASIC_PASSWORD || (sk && sk.clientSecret) || "";
  const requestedAuthMode = (process.env.SAP_AUTH_MODE || "auto").toLowerCase();

  let authMode = requestedAuthMode;
  if (authMode === "auto") {
    authMode = basicUsername && basicPassword ? "basic" : "oauth";
  }

  if (!["basic", "oauth"].includes(authMode)) {
    throw new Error("SAP_AUTH_MODE must be one of: auto, basic, oauth");
  }

  function sapRequired(envName, skValue) {
    const resolved = skValue || process.env[envName];
    if (!resolved) {
      throw new Error(
        `Missing SAP credential: set ${envName} in .env or provide SAP_SERVICE_KEY_PATH`
      );
    }
    return resolved;
  }

  return {
    sap: {
      authMode,
      tokenUrl: authMode === "oauth" ? sapRequired("SAP_TOKEN_URL", sk && sk.tokenUrl) : "",
      clientId: authMode === "oauth" ? sapRequired("SAP_CLIENT_ID", sk && sk.clientId) : "",
      clientSecret: authMode === "oauth" ? sapRequired("SAP_CLIENT_SECRET", sk && sk.clientSecret) : "",
      basicUsername: authMode === "basic" ? basicUsername : "",
      basicPassword: authMode === "basic" ? basicPassword : "",
      cpiBaseUrl: sapRequired("SAP_CPI_BASE_URL", sk && sk.cpiBaseUrl),
      timeoutMs: readInt("SAP_API_TIMEOUT_MS", 30000),
      maxRetries: readInt("SAP_API_MAX_RETRIES", 3),
      pageSize: readInt("SAP_API_PAGE_SIZE", 100)
    },
    output: {
      outputDir: path.resolve(process.env.OUTPUT_DIR || "./output"),
      retentionDays: readInt("RETENTION_DAYS", 90)
    },
    scheduler: {
      cronExpression: process.env.CRON_EXPRESSION || "0 30 2 * * *",
      timezone: process.env.TIMEZONE || "Europe/Rome"
    },
    alert: {
      webhookUrl: process.env.ALERT_WEBHOOK_URL || "",
      emailTo: process.env.ALERT_EMAIL_TO || ""
    }
  };
}

function validateConfig() {
  const cfg = loadConfig();
  if (!fs.existsSync(cfg.output.outputDir)) {
    fs.mkdirSync(cfg.output.outputDir, { recursive: true });
  }
  return cfg;
}

module.exports = {
  loadConfig,
  validateConfig,
  createConfigFromServiceKeyObject
};
