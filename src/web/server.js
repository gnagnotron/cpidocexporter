const express = require("express");

const { fetchAllIflows } = require("../api/sapClient");
const { createConfigFromServiceKeyObject } = require("../core/config");
const { createMetrics, finalizeMetrics } = require("../core/metrics");
const { buildCanonicalModel, validateModel } = require("../core/model");
const { renderHtml } = require("../render/htmlRenderer");

const app = express();
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

app.use(express.json({ limit: "2mb" }));

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
    .warn {
      color: #9a3412;
      font-size: 0.85rem;
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
    </section>

    <section class="card">
      <label for="serviceKey">Service Key JSON</label>
      <textarea id="serviceKey" placeholder="Paste full service key JSON..."></textarea>

      <div class="row">
        <div>
          <label for="cpiBaseUrl">CPI Base URL (optional override)</label>
          <input id="cpiBaseUrl" placeholder="https://<tenant>/api/v1" />
        </div>
        <div>
          <label for="fileInput">Or load from file</label>
          <input id="fileInput" type="file" accept="application/json,.json" />
        </div>
      </div>

      <div class="actions">
        <button id="generateBtn" type="button">Generate HTML</button>
        <button id="clearBtn" type="button" class="secondary">Clear</button>
        <span class="status" id="status"></span>
      </div>
    </section>
  </main>

  <script>
    (function () {
      const serviceKeyEl = document.getElementById('serviceKey');
      const cpiBaseUrlEl = document.getElementById('cpiBaseUrl');
      const fileInputEl = document.getElementById('fileInput');
      const generateBtn = document.getElementById('generateBtn');
      const clearBtn = document.getElementById('clearBtn');
      const statusEl = document.getElementById('status');

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
        cpiBaseUrlEl.value = '';
        fileInputEl.value = '';
        statusEl.textContent = '';
      });

      generateBtn.addEventListener('click', async function () {
        const raw = serviceKeyEl.value.trim();
        const override = cpiBaseUrlEl.value.trim();

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

        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceKey: parsed, cpiBaseUrl: override || undefined })
          });

          if (!response.ok) {
            const payload = await response.json().catch(function () { return {}; });
            throw new Error(payload.error || 'Generation failed with HTTP ' + response.status);
          }

          const blob = await response.blob();
          const suggested = response.headers.get('x-report-name') || 'sap-cpi-docs.html';
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = suggested;
          link.click();
          window.URL.revokeObjectURL(url);

          statusEl.textContent = 'Done. HTML downloaded successfully.';
        } catch (err) {
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

app.post("/api/generate", async (req, res) => {
  try {
    const serviceKey = parseServiceKeyBody(req.body);
    const config = createConfigFromServiceKeyObject(serviceKey, {
      cpiBaseUrl: req.body && req.body.cpiBaseUrl ? String(req.body.cpiBaseUrl) : ""
    });

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
