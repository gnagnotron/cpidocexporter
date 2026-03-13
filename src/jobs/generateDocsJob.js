const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const { fetchAllIflows } = require("../api/sapClient");
const { validateConfig } = require("../core/config");
const logger = require("../core/logger");
const { createMetrics, finalizeMetrics } = require("../core/metrics");
const { buildCanonicalModel, validateModel } = require("../core/model");
const { writeJson, readJsonIfExists, cleanupOldReports } = require("../core/storage");
const { renderHtml } = require("../render/htmlRenderer");
const { sendAlert } = require("../core/alerts");

function formatDateForFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

async function runGeneration() {
  const metrics = createMetrics();
  const config = validateConfig();
  const outputDir = config.output.outputDir;

  const latestJsonPath = path.join(outputDir, "latest.json");
  const lastGoodJsonPath = path.join(outputDir, "last-good.json");
  const htmlPath = path.join(outputDir, "index.html");
  const datedHtmlPath = path.join(outputDir, `report-${formatDateForFilename()}.html`);

  try {
    logger.info("Starting SAP CPI docs generation");

    const iflows = await fetchAllIflows(config, metrics);
    const model = buildCanonicalModel(iflows, finalizeMetrics(metrics));
    const validationErrors = validateModel(model);

    if (validationErrors.length > 0) {
      throw new Error(`Quality gate failed: ${validationErrors.join("; ")}`);
    }

    const html = renderHtml(model);

    writeJson(latestJsonPath, model);
    writeJson(lastGoodJsonPath, model);
    fs.writeFileSync(htmlPath, html, "utf8");
    fs.writeFileSync(datedHtmlPath, html, "utf8");

    cleanupOldReports(outputDir, config.output.retentionDays);

    logger.info("Generation completed", {
      iflowCount: model.summary.totalIflows,
      durationMs: model.metrics.durationMs
    });

    await sendAlert(config, {
      status: "SUCCESS",
      message: `Generated ${model.summary.totalIflows} iFlows`,
      metrics: model.metrics
    });
  } catch (error) {
    metrics.errors += 1;
    logger.error("Generation failed", { error: error.message });

    const fallback = readJsonIfExists(lastGoodJsonPath);
    if (fallback) {
      const html = renderHtml(fallback);
      fs.writeFileSync(htmlPath, html, "utf8");
      logger.warn("Fallback activated using last-good.json");
    }

    await sendAlert(config, {
      status: "FAILED",
      message: error.message,
      metrics: finalizeMetrics(metrics)
    });

    throw error;
  }
}

function scheduleDailyJob() {
  const config = validateConfig();

  if (!cron.validate(config.scheduler.cronExpression)) {
    throw new Error(`Invalid CRON_EXPRESSION: ${config.scheduler.cronExpression}`);
  }

  logger.info("Scheduler started", {
    cron: config.scheduler.cronExpression,
    timezone: config.scheduler.timezone
  });

  cron.schedule(
    config.scheduler.cronExpression,
    async () => {
      try {
        await runGeneration();
      } catch (_error) {
        // Error is already logged and alerted in runGeneration.
      }
    },
    {
      timezone: config.scheduler.timezone
    }
  );
}

module.exports = {
  runGeneration,
  scheduleDailyJob
};
