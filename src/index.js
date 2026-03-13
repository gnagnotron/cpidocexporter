const { validateConfig } = require("./core/config");
const logger = require("./core/logger");
const { runGeneration, scheduleDailyJob } = require("./jobs/generateDocsJob");

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--validate-config")) {
    validateConfig();
    logger.info("Config validation OK");
    return;
  }

  if (args.includes("--once")) {
    await runGeneration();
    return;
  }

  scheduleDailyJob();
  logger.info("Waiting for scheduled execution");
}

main().catch((error) => {
  logger.error("Fatal execution error", { error: error.message });
  process.exitCode = 1;
});
