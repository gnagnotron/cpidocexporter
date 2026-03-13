const axios = require("axios");
const logger = require("./logger");

async function sendAlert(config, summary) {
  if (!config.alert.webhookUrl) {
    logger.warn("Alert skipped: ALERT_WEBHOOK_URL not configured", { summary });
    return;
  }

  try {
    await axios.post(
      config.alert.webhookUrl,
      {
        text: `[SAP CPI DOC] ${summary.status}: ${summary.message}`,
        details: summary
      },
      { timeout: 10000 }
    );
  } catch (error) {
    logger.error("Failed to send webhook alert", { error: error.message });
  }
}

module.exports = {
  sendAlert
};
