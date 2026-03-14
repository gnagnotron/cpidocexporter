const express = require("express");

const { fetchAllIflows } = require("../api/sapClient");
const { createConfigFromServiceKeyObject } = require("../core/config");
const { createMetrics, finalizeMetrics } = require("../core/metrics");
const { buildCanonicalModel, validateModel } = require("../core/model");
const { renderHtml } = require("../render/htmlRenderer");

const app = express();
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const JOB_TTL_MS = 30 * 60 * 1000;
const jobs = new Map();

app.use(express.json({ limit: "2mb" }));

function clampPercentage(value) {
  const numeric = Number.parseInt(String(value || "0"), 10);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, numeric));
}

function cleanupOldJobs() {
  const threshold = Date.now() - JOB_TTL_MS;
  for (const [jobId, job] of jobs.entries()) {
    if ((job.updatedAt || job.createdAt || 0) < threshold) {
      jobs.delete(jobId);
    }
  }
}

function createGenerationJob() {
  cleanupOldJobs();

  const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const job = {
    id: jobId,
    status: "queued",
    stage: "Queued",
    percentage: 0,
    reportName: "",
    html: "",
    error: "",
    createdAt: now,
    updatedAt: now
  };

  jobs.set(jobId, job);
  return job;
}

function startGenerationJob(job, serviceKey) {
  (async () => {
    try {
      job.status = "running";
      job.stage = "Starting generation";
      job.percentage = 1;
      job.updatedAt = Date.now();

      const config = createConfigFromServiceKeyObject(serviceKey);
      const metrics = createMetrics();

      const iflows = await fetchAllIflows(config, metrics, (progress) => {
        job.percentage = clampPercentage(progress && progress.percentage);
        job.stage = String((progress && progress.stage) || "Generating");
        job.updatedAt = Date.now();
      });

      job.percentage = 95;
      job.stage = "Building canonical model";
      job.updatedAt = Date.now();
      const model = buildCanonicalModel(iflows, finalizeMetrics(metrics));

      const validationErrors = validateModel(model);
      if (validationErrors.length > 0) {
        throw new Error(`Quality gate failed: ${validationErrors.join("; ")}`);
      }

      job.percentage = 98;
      job.stage = "Rendering HTML";
      job.updatedAt = Date.now();
      const html = renderHtml(model);

      job.html = html;
      job.reportName = `sap-cpi-docs-${new Date().toISOString().slice(0, 10)}.html`;
      job.percentage = 100;
      job.stage = "Completed";
      job.status = "completed";
      job.updatedAt = Date.now();
    } catch (error) {
      job.status = "failed";
      job.error = error && error.message ? error.message : "Generation failed";
      job.stage = "Failed";
      job.updatedAt = Date.now();
    }
  })();
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHomePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SAP CPI Docs Generator</title>
  <style>
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: linear-gradient(160deg, #f8fafc 0%, #eef2ff 40%, #fdf2f8 100%);
      color: #1f2937;
    }
    main {
      max-width: 920px;
      margin: 0 auto;
      padding: 2rem 1rem 3rem 1rem;
    }
    .card {
      background: rgba(255,255,255,0.92);
      border: 1px solid #dbe4ea;
      border-radius: 14px;
      padding: 1rem;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
      margin-bottom: 1rem;
    }
    h1 {
      margin: 0 0 0.4rem 0;
      font-size: 1.8rem;
    }
    p {
      margin: 0.3rem 0;
      line-height: 1.45;
    }
    label {
      display: block;
      font-weight: 600;
      margin: 0.45rem 0 0.25rem 0;
    }
    textarea, input, button {
      font: inherit;
    }
    textarea {
      width: 100%;
      min-height: 260px;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      padding: 0.7rem;
      resize: vertical;
      box-sizing: border-box;
      background: #ffffff;
    }
    input {
      width: 100%;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      padding: 0.55rem 0.65rem;
      box-sizing: border-box;
      background: #ffffff;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8rem;
    }
    .actions {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      margin-top: 0.8rem;
      flex-wrap: wrap;
    }
    button {
      border: 1px solid #0f766e;
      background: #0f766e;
      color: white;
      border-radius: 999px;
      padding: 0.45rem 0.85rem;
      cursor: pointer;
      font-weight: 700;
    }
    button.secondary {
      border-color: #94a3b8;
      background: #ffffff;
      color: #334155;
    }
    .status {
      font-size: 0.9rem;
      color: #334155;
      white-space: pre-wrap;
    }
    .progress-wrap {
      margin-top: 0.75rem;
      display: none;
    }
    .progress-wrap.active {
      display: block;
    }
    .progress-head {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: #334155;
      margin-bottom: 0.35rem;
    }
    .progress-bar {
      width: 100%;
      height: 12px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      background: #e2e8f0;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #0f766e 0%, #14b8a6 100%);
      transition: width 0.35s ease;
    }
    .warn {
      color: #9a3412;
      font-size: 0.85rem;
    }
    .repo-link {
      display: inline-flex;
      margin-top: 0.45rem;
      color: #0f766e;
      font-weight: 700;
      text-decoration: none;
      border-bottom: 1px solid #99f6e4;
      padding-bottom: 0.1rem;
    }
    .repo-link:hover {
      color: #0d9488;
      border-bottom-color: #5eead4;
    }
    @media (max-width: 760px) {
      .row {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>SAP CPI Docs Generator</h1>
      <p>Paste your SAP service key JSON and generate HTML documentation.</p>
      <p class="warn">Security note: service key is processed in memory and not persisted server-side.</p>
      <a class="repo-link" href="https://github.com/gnagnotron/cpidocexporter" target="_blank" rel="noopener noreferrer">GitHub repository (feedback and issues)</a>
    </section>

    <section class="card">
      <label for="serviceKey">Service Key JSON</label>
      <textarea id="serviceKey" placeholder="Paste full service key JSON..."></textarea>

      <label for="fileInput">Or load from file</label>
      <input id="fileInput" type="file" accept="application/json,.json" />

      <div class="actions">
        <button id="generateBtn" type="button">Generate HTML</button>
        <button id="clearBtn" type="button" class="secondary">Clear</button>
        <span class="status" id="status"></span>
      </div>
      <div class="progress-wrap" id="progressWrap">
        <div class="progress-head">
          <span id="progressStage">Waiting...</span>
          <strong id="progressPercent">0%</strong>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="progressBar">
          <div class="progress-fill" id="progressFill"></div>
        </div>
      </div>
    </section>
  </main>

  <script>
    (function () {
      const serviceKeyEl = document.getElementById('serviceKey');
      const fileInputEl = document.getElementById('fileInput');
      const generateBtn = document.getElementById('generateBtn');
      const clearBtn = document.getElementById('clearBtn');
      const statusEl = document.getElementById('status');
      const progressWrap = document.getElementById('progressWrap');
      const progressFill = document.getElementById('progressFill');
      const progressBar = document.getElementById('progressBar');
      const progressStage = document.getElementById('progressStage');
      const progressPercent = document.getElementById('progressPercent');

      function updateProgress(percentage, stage) {
        const value = Math.max(0, Math.min(100, Number.parseInt(String(percentage || 0), 10) || 0));
        progressFill.style.width = value + '%';
        progressBar.setAttribute('aria-valuenow', String(value));
        progressPercent.textContent = value + '%';
        progressStage.textContent = stage || 'Generating...';
      }

      async function downloadReport(jobId) {
        const response = await fetch('/api/generate/download/' + encodeURIComponent(jobId));
        if (!response.ok) {
          const payload = await response.json().catch(function () { return {}; });
          throw new Error(payload.error || ('Download failed with HTTP ' + response.status));
        }

        const blob = await response.blob();
        const suggested = response.headers.get('x-report-name') || 'sap-cpi-docs.html';
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = suggested;
        link.click();
        window.URL.revokeObjectURL(url);
      }

      async function waitForCompletion(jobId) {
        while (true) {
          const response = await fetch('/api/generate/status/' + encodeURIComponent(jobId), { cache: 'no-store' });
          if (!response.ok) {
            const payload = await response.json().catch(function () { return {}; });
            throw new Error(payload.error || ('Status failed with HTTP ' + response.status));
          }

          const payload = await response.json();
          updateProgress(payload.percentage || 0, payload.stage || 'Generating...');

          if (payload.status === 'completed') {
            return;
          }

          if (payload.status === 'failed') {
            throw new Error(payload.error || 'Generation failed');
          }

          await new Promise(function (resolve) { setTimeout(resolve, 1200); });
        }
      }

      fileInputEl.addEventListener('change', function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = function () {
          serviceKeyEl.value = String(reader.result || '');
        };
        reader.readAsText(file);
      });

      clearBtn.addEventListener('click', function () {
        serviceKeyEl.value = '';
        fileInputEl.value = '';
        statusEl.textContent = '';
        progressWrap.classList.remove('active');
        updateProgress(0, 'Waiting...');
      });

      generateBtn.addEventListener('click', async function () {
        const raw = serviceKeyEl.value.trim();

        if (!raw) {
          statusEl.textContent = 'Please provide a service key JSON first.';
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          statusEl.textContent = 'Invalid JSON: ' + err.message;
          return;
        }

        generateBtn.disabled = true;
        statusEl.textContent = 'Generating documentation... this can take 1-3 minutes.';
        progressWrap.classList.add('active');
        updateProgress(1, 'Starting generation');

        try {
          const response = await fetch('/api/generate/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceKey: parsed })
          });

          if (!response.ok) {
            const payload = await response.json().catch(function () { return {}; });
            throw new Error(payload.error || 'Generation failed with HTTP ' + response.status);
          }

          const payload = await response.json();
          if (!payload || !payload.jobId) {
            throw new Error('Server did not return a job id');
          }

          await waitForCompletion(payload.jobId);
          await downloadReport(payload.jobId);

          statusEl.textContent = 'Done. HTML downloaded successfully.';
        } catch (err) {
          updateProgress(0, 'Failed');
          statusEl.textContent = 'Error: ' + err.message;
        } finally {
          generateBtn.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;
}

function parseServiceKeyBody(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Missing JSON body");
  }

  if (body.serviceKey && typeof body.serviceKey === "object") {
    return body.serviceKey;
  }

  throw new Error("Missing serviceKey object in request body");
}

app.get("/", (_req, res) => {
  res.status(200).type("html").send(renderHomePage());
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/api/generate/start", (req, res) => {
  try {
    const serviceKey = parseServiceKeyBody(req.body);
    const job = createGenerationJob();
    startGenerationJob(job, serviceKey);
    res.status(202).json({ jobId: job.id, status: job.status });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/generate/status/:jobId", (req, res) => {
  cleanupOldJobs();
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }

  res.status(200).json({
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    percentage: clampPercentage(job.percentage),
    error: job.error || ""
  });
});

app.get("/api/generate/download/:jobId", (req, res) => {
  cleanupOldJobs();
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }

  if (job.status !== "completed" || !job.html) {
    res.status(409).json({ error: "Report is not ready yet" });
    return;
  }

  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .setHeader("Content-Disposition", `attachment; filename="${job.reportName || "sap-cpi-docs.html"}"`)
    .setHeader("x-report-name", job.reportName || "sap-cpi-docs.html")
    .send(job.html);
});

app.post("/api/generate", async (req, res) => {
  try {
    const serviceKey = parseServiceKeyBody(req.body);
    const config = createConfigFromServiceKeyObject(serviceKey);

    const metrics = createMetrics();
    const iflows = await fetchAllIflows(config, metrics);
    const model = buildCanonicalModel(iflows, finalizeMetrics(metrics));
    const validationErrors = validateModel(model);
    if (validationErrors.length > 0) {
      throw new Error(`Quality gate failed: ${validationErrors.join("; ")}`);
    }

    const html = renderHtml(model);
    const reportName = `sap-cpi-docs-${new Date().toISOString().slice(0, 10)}.html`;

    res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .setHeader("Content-Disposition", `attachment; filename="${reportName}"`)
      .setHeader("x-report-name", reportName)
      .send(html);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.use((err, _req, res, _next) => {
  const safeMessage = err && err.message ? err.message : "Unexpected server error";
  res.status(500).json({ error: escapeHtml(safeMessage) });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Web server listening on port ${PORT}`);
});
