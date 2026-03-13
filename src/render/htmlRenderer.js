const DEFAULT_LIMIT = 10;

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(input) {
  return String(input || "").toLowerCase();
}

function renderTable(headers, rows, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : null;
  const tableId = options.tableId || "";
  const emptyMessage = options.emptyMessage || "No records found.";

  if (!rows || rows.length === 0) {
    return `<p>${escapeHtml(emptyMessage)}</p>`;
  }

  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row, index) => `<tr data-row="1" data-index="${index}">${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  const controls = limit && rows.length > limit
    ? `<div class="table-meta"><span data-count></span><button type="button" class="table-toggle" data-expanded="0">Show all</button></div>`
    : "";

  return `
    <div class="table-shell" ${tableId ? `id="${escapeHtml(tableId)}"` : ""} ${limit ? `data-limit="${limit}"` : ""}>
      <div class="table-wrap">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      ${controls}
    </div>
  `;
}

function renderList(items, emptyMessage) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (values.length === 0) {
    return `<p>${escapeHtml(emptyMessage)}</p>`;
  }
  return `<ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderMiniChips(items, emptyMessage, className = "mini-chip") {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (values.length === 0) {
    return `<p class="muted-inline">${escapeHtml(emptyMessage)}</p>`;
  }
  return `<div class="mini-chip-list">${values.map((item) => `<span class="${escapeHtml(className)}">${escapeHtml(item)}</span>`).join("")}</div>`;
}

function getAdapterColorClass(type) {
  const normalized = normalizeText(type);
  if (!normalized) {
    return "adapter-other";
  }
  if (/(http|https|odata|rest|soap)/.test(normalized)) {
    return "adapter-api";
  }
  if (/(sftp|ftp|file|nfs)/.test(normalized)) {
    return "adapter-file";
  }
  if (/(idoc|rfc|xi|successfactors|ariba)/.test(normalized)) {
    return "adapter-sap";
  }
  if (/(jdbc|db|hana|sql)/.test(normalized)) {
    return "adapter-db";
  }
  if (/(jms|amqp|kafka|mq|event)/.test(normalized)) {
    return "adapter-msg";
  }
  return "adapter-other";
}

function renderAdapterTypeChips(adapters, emptyMessage) {
  const values = (Array.isArray(adapters) ? adapters : []).filter(Boolean);
  if (values.length === 0) {
    return `<p class="muted-inline">${escapeHtml(emptyMessage)}</p>`;
  }

  return `
    <div class="mini-chip-list">
      ${values.map((adapter) => {
        const direction = escapeHtml(adapter.direction || "");
        const type = escapeHtml(adapter.type || "Unknown");
        const css = getAdapterColorClass(adapter.type);
        const label = direction ? `${direction} - ${type}` : type;
        return `<span class="mini-chip adapter-chip ${css}">${label}</span>`;
      }).join("")}
    </div>
  `;
}

function renderInternalStepsTimeline(steps) {
  const values = (Array.isArray(steps) ? steps : []).filter(Boolean);
  if (values.length === 0) {
    return `<p class="muted-inline">No internal steps extracted.</p>`;
  }

  const preview = values.slice(0, DEFAULT_LIMIT);
  const more = values.length - preview.length;

  return `
    <div class="timeline-wrap">
      <ol class="step-timeline">
        ${preview.map((step) => {
          const titleParts = [step.stepType, step.name].filter(Boolean);
          const title = titleParts.join(" - ") || "Step";
          const metaParts = [step.process, step.bpmnType, step.reference].filter(Boolean);
          return `
            <li class="step-item">
              <span class="step-dot" aria-hidden="true"></span>
              <div class="step-content">
                <p class="step-title">${escapeHtml(title)}</p>
                <p class="step-meta">${escapeHtml(metaParts.join(" | ") || "No additional metadata")}</p>
              </div>
            </li>
          `;
        }).join("")}
      </ol>
      ${more > 0 ? `<p class="timeline-more">+${more} more steps in full extraction.</p>` : ""}
    </div>
  `;
}

function renderOptions(values, placeholder) {
  const entries = Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
  return [`<option value="">${escapeHtml(placeholder)}</option>`, ...entries.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)].join("");
}

function renderHubCards(cards, containerId, emptyMessage) {
  if (!cards || cards.length === 0) {
    return `<p>${escapeHtml(emptyMessage)}</p>`;
  }

  return `
    <div class="hub-list" id="${escapeHtml(containerId)}">
      ${cards.join("")}
    </div>
  `;
}

function renderHubCard(hub) {
  const sourcesPreview = hub.sources.slice(0, DEFAULT_LIMIT);
  const targetsPreview = hub.targets.slice(0, DEFAULT_LIMIT);
  const sourceMore = hub.sources.length - sourcesPreview.length;
  const targetMore = hub.targets.length - targetsPreview.length;

  return `
    <article class="hub-card" data-filter-item="1" data-filter-0="${escapeHtml(hub.type)}" data-filter-1="${escapeHtml(hub.endpoint)}">
      <div class="hub-card-header">
        <div>
          <h4>${escapeHtml(hub.type)} <small>${escapeHtml(hub.topology)}</small></h4>
          <p class="hub-endpoint">${escapeHtml(hub.endpoint)}</p>
        </div>
        <div class="hub-stats">
          <span>${escapeHtml(hub.relation)}</span>
          <span>${hub.sourceCount} sources</span>
          <span>${hub.targetCount} targets</span>
        </div>
      </div>
      <div class="hub-columns">
        <div class="hub-column">
          <h5>Source iFlows</h5>
          <div class="hub-chip-list">
            ${sourcesPreview.map((source) => `<span class="hub-chip">${escapeHtml(source)}</span>`).join("")}
            ${sourceMore > 0 ? `<span class="hub-chip hub-chip-more">+${sourceMore} more</span>` : ""}
          </div>
        </div>
        <div class="hub-column">
          <h5>Target iFlows</h5>
          <div class="hub-chip-list">
            ${targetsPreview.map((target) => `<span class="hub-chip">${escapeHtml(target)}</span>`).join("")}
            ${targetMore > 0 ? `<span class="hub-chip hub-chip-more">+${targetMore} more</span>` : ""}
          </div>
        </div>
      </div>
    </article>
  `;
}

function buildFlagBadges(flags) {
  const badges = [];
  if (flags.hasBasicAuth) {
    badges.push({ className: "badge-basic", label: "Basic" });
  }
  if (flags.hasSapCloudConnector) {
    badges.push({ className: "badge-sapcc", label: "sapcc" });
  }
  if (flags.hasCredentialRefs) {
    badges.push({ className: "badge-cred", label: "CredentialRef" });
  }
  if (flags.hasSecureParameters) {
    badges.push({ className: "badge-secure", label: "SecureParam" });
  }
  return badges;
}

function renderBadges(flags) {
  const badges = buildFlagBadges(flags);
  if (badges.length === 0) {
    return "";
  }
  return `<div class="badges">${badges.map((badge) => `<span class="badge ${badge.className}">${escapeHtml(badge.label)}</span>`).join("")}</div>`;
}

function renderFilterControls(model) {
  const packages = Array.from(new Set((model.integrations || []).map((item) => item.packageName || item.packageId).filter(Boolean))).sort();
  const iflows = (model.integrations || []).map((item) => item.name || item.id).sort((a, b) => a.localeCompare(b));

  return `
    <section class="card" id="filters-card">
      <h2>Filters</h2>
      <p>Use these filters to focus on one flow, one package, or a specific term.</p>
      <div class="filters-grid">
        <label>
          Search
          <input id="filter-search" type="search" placeholder="endpoint, adapter, script, credential..." />
        </label>
        <label>
          Package
          <select id="filter-package">
            <option value="">All packages</option>
            ${packages.map((pkg) => `<option value="${escapeHtml(pkg)}">${escapeHtml(pkg)}</option>`).join("")}
          </select>
        </label>
        <label>
          iFlow
          <select id="filter-iflow">
            <option value="">All iFlows</option>
            ${iflows.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
          </select>
        </label>
        <div class="filters-actions">
          <button id="filter-reset" type="button">Reset</button>
          <span id="filter-count"></span>
        </div>
      </div>
    </section>
  `;
}

function renderTopicMenu() {
  return `
    <section class="card" id="topic-menu">
      <h2>Documentation Menu</h2>
      <p>Select the topic you want to inspect.</p>
      <div class="topic-grid">
        <a class="topic-link" href="#topic-explorer" data-open-tab="tab-overview">Guided Search</a>
        <a class="topic-link" href="#inter-iflow-section" data-open-tab="tab-connectivity">Inter-iFlow Links</a>
        <a class="topic-link" href="#hubs-section" data-open-tab="tab-connectivity">Connection Topologies</a>
        <a class="topic-link" href="#adapter-inventory-section" data-open-tab="tab-security">Adapters & Security</a>
        <a class="topic-link" href="#dependency-section" data-open-tab="tab-internals">Dependencies</a>
        <a class="topic-link" href="#iflow-catalog" data-open-tab="tab-internals">iFlow Catalog</a>
      </div>
    </section>
  `;
}

function buildTopicDataset(model) {
  const links = Array.isArray(model.interIflowLinks) ? model.interIflowLinks : [];
  const byId = new Map(links.flatMap((link) => [[link.from, link], [link.to, link]]));
  const entries = (Array.isArray(model.integrations) ? model.integrations : []).map((integration) => {
    const packageName = integration.packageName || integration.packageId || "";
    const runtimeStatus = integration.runtime && integration.runtime.status ? integration.runtime.status : "NotDeployed";
    const errorMode = integration.errorHandling && integration.errorHandling.hasErrorFlow ? "HasErrorFlow" : "NoErrorFlow";
    const dependencies = (integration.dependencies || []).map((dependency) => `${dependency.type}:${dependency.name}`).filter(Boolean);
    const processNames = Array.from(new Set((integration.internalSteps || []).map((step) => step.process).filter(Boolean)));
    const linkedEndpoints = links
      .filter((link) => link.from === integration.id || link.to === integration.id)
      .map((link) => `${link.type}:${link.endpoint}`);

    return {
      id: integration.id,
      name: integration.name,
      packageName,
      credentials: Array.from(new Set([
        ...(integration.securityDetails && integration.securityDetails.credentialRefs ? integration.securityDetails.credentialRefs : []),
        ...(integration.securityDetails && integration.securityDetails.secureParameterKeys ? integration.securityDetails.secureParameterKeys : [])
      ].filter(Boolean))),
      adapterTypes: Array.from(new Set((integration.adapters || []).map((adapter) => adapter.type).filter(Boolean))),
      endpoints: Array.from(new Set((integration.adapters || []).map((adapter) => adapter.endpoint).filter(Boolean))),
      inputEndpoints: Array.from(new Set((integration.adapters || []).filter((adapter) => /receiver/i.test(adapter.direction || "")).map((adapter) => adapter.endpoint).filter(Boolean))),
      outputEndpoints: Array.from(new Set((integration.adapters || []).filter((adapter) => /sender/i.test(adapter.direction || "")).map((adapter) => adapter.endpoint).filter(Boolean))),
      stepTypes: Array.from(new Set((integration.internalSteps || []).map((step) => step.stepType).filter(Boolean))),
      processNames,
      dependencyKeys: dependencies,
      runtimeStatus,
      errorMode,
      linkEndpoints: linkedEndpoints,
      securityFlags: [
        integration.flags && integration.flags.hasBasicAuth ? "Basic" : "",
        integration.flags && integration.flags.hasSapCloudConnector ? "sapcc" : "",
        integration.flags && integration.flags.hasCredentialRefs ? "CredentialRef" : "",
        integration.flags && integration.flags.hasSecureParameters ? "SecureParam" : ""
      ].filter(Boolean),
      inputs: (integration.adapters || []).filter((adapter) => /receiver/i.test(adapter.direction || "")).map((adapter) => adapter.endpoint).filter(Boolean),
      outputs: (integration.adapters || []).filter((adapter) => /sender/i.test(adapter.direction || "")).map((adapter) => adapter.endpoint).filter(Boolean),
      internalStepCount: (integration.internalSteps || []).length
    };
  });

  return {
    entries,
    topics: {
      credential: Array.from(new Set(entries.flatMap((entry) => entry.credentials))).sort((a, b) => a.localeCompare(b)),
      package: Array.from(new Set(entries.map((entry) => entry.packageName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
      iflow: Array.from(new Set(entries.map((entry) => entry.name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
      adapter: Array.from(new Set(entries.flatMap((entry) => entry.adapterTypes))).sort((a, b) => a.localeCompare(b)),
      endpoint: Array.from(new Set(entries.flatMap((entry) => entry.endpoints))).sort((a, b) => a.localeCompare(b)),
      input: Array.from(new Set(entries.flatMap((entry) => entry.inputEndpoints))).sort((a, b) => a.localeCompare(b)),
      output: Array.from(new Set(entries.flatMap((entry) => entry.outputEndpoints))).sort((a, b) => a.localeCompare(b)),
      step: Array.from(new Set(entries.flatMap((entry) => entry.stepTypes))).sort((a, b) => a.localeCompare(b)),
      process: Array.from(new Set(entries.flatMap((entry) => entry.processNames))).sort((a, b) => a.localeCompare(b)),
      dependency: Array.from(new Set(entries.flatMap((entry) => entry.dependencyKeys))).sort((a, b) => a.localeCompare(b)),
      runtime: Array.from(new Set(entries.map((entry) => entry.runtimeStatus))).sort((a, b) => a.localeCompare(b)),
      error: ["HasErrorFlow", "NoErrorFlow"],
      link: Array.from(new Set(entries.flatMap((entry) => entry.linkEndpoints))).sort((a, b) => a.localeCompare(b)),
      flag: ["Basic", "sapcc", "CredentialRef", "SecureParam"]
    }
  };
}

function renderTopicExplorer() {
  return `
    <section class="card" id="topic-explorer">
      <h2>Guided Topic Explorer</h2>
      <p>Choose one topic and one value to list related iFlows. Example: Credential -> alias={{s4.cred}}.</p>
      <div class="topic-explorer-grid">
        <label>
          Topic
          <select id="topic-field">
            <option value="credential">Credential</option>
            <option value="flag">Security Flag</option>
            <option value="package">Package</option>
            <option value="iflow">iFlow</option>
            <option value="adapter">Adapter Type</option>
            <option value="endpoint">Any Endpoint / Queue</option>
            <option value="input">Input Endpoint (Receiver)</option>
            <option value="output">Output Endpoint (Sender)</option>
            <option value="step">Internal Step Type</option>
            <option value="process">Internal Process Name</option>
            <option value="dependency">Dependency Artifact</option>
            <option value="runtime">Runtime Status</option>
            <option value="error">Error Handling</option>
            <option value="link">Inter-iFlow Link Endpoint</option>
          </select>
        </label>
        <label>
          Value
          <select id="topic-value"></select>
        </label>
        <div class="topic-actions">
          <button id="topic-apply" type="button">Search</button>
          <button id="topic-reset" type="button">Reset</button>
        </div>
      </div>
      <div id="topic-result-count" class="topic-result-count"></div>
      <div class="table-shell" id="topic-results-shell" data-limit="10">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th><button type="button" class="topic-sort-btn" data-topic-sort="iflow">iFlow</button></th>
                <th><button type="button" class="topic-sort-btn" data-topic-sort="package">Package</button></th>
                <th><button type="button" class="topic-sort-btn" data-topic-sort="matched">Matched Topic</button></th>
                <th><button type="button" class="topic-sort-btn" data-topic-sort="inputs">Inputs</button></th>
                <th><button type="button" class="topic-sort-btn" data-topic-sort="outputs">Outputs</button></th>
                <th><button type="button" class="topic-sort-btn" data-topic-sort="steps">Internal Steps</button></th>
              </tr>
            </thead>
            <tbody id="topic-results-body"></tbody>
          </table>
        </div>
        <div class="table-meta"><span data-count></span><button type="button" class="table-toggle" data-expanded="0">Show all</button></div>
      </div>
    </section>
  `;
}

function renderSectionTabs() {
  return `
    <section class="card" id="section-tabs">
      <h2>View Mode</h2>
      <p>Show one topic at a time for faster reading.</p>
      <div class="tabs-row" role="tablist" aria-label="Documentation sections">
        <button type="button" class="tab-btn active" data-tab-target="tab-overview" role="tab" aria-selected="true">Overview</button>
        <button type="button" class="tab-btn" data-tab-target="tab-security" role="tab" aria-selected="false">Security</button>
        <button type="button" class="tab-btn" data-tab-target="tab-connectivity" role="tab" aria-selected="false">Connectivity</button>
        <button type="button" class="tab-btn" data-tab-target="tab-internals" role="tab" aria-selected="false">Internals</button>
      </div>
    </section>
  `;
}

function renderCatalogFilters(model) {
  const packages = (model.integrations || []).map((entry) => entry.packageName || entry.packageId).filter(Boolean);
  const iflows = (model.integrations || []).map((entry) => entry.name || entry.id).filter(Boolean);
  return `
    <div class="section-filters" id="catalog-filters">
      <label>
        <span>iFlow</span>
        <select id="catalog-filter-iflow">${renderOptions(iflows, "All iFlows")}</select>
      </label>
      <label>
        <span>Package</span>
        <select id="catalog-filter-package">${renderOptions(packages, "All packages")}</select>
      </label>
      <button type="button" id="catalog-filter-reset">Reset</button>
      <div class="filters-actions"><span id="catalog-filter-count"></span></div>
    </div>
  `;
}

function renderSummary(model) {
  const s = model.summary;
  const withAdapters = model.integrations.filter((item) => item.adapters && item.adapters.length > 0).length;
  const withConfigs = model.integrations.filter((item) => item.configurations && item.configurations.length > 0).length;
  const withResources = model.integrations.filter((item) => item.resources && item.resources.length > 0).length;
  const withRuntime = model.integrations.filter((item) => item.runtime).length;
  return `
    <section class="card">\n      <h2>Summary</h2>\n      <div class="summary-grid">\n        <div><strong>${s.totalIflows}</strong><span>Total iFlow</span></div>\n        <div><strong>${s.totalDependencies}</strong><span>Total Dependencies</span></div>\n        <div><strong>${s.withErrorFlow}</strong><span>With Error Flow</span></div>\n        <div><strong>${withAdapters}</strong><span>With Adapters</span></div>\n        <div><strong>${withRuntime}</strong><span>With Runtime Artifact</span></div>\n        <div><strong>${withConfigs}</strong><span>With Config Params</span></div>\n        <div><strong>${withResources}</strong><span>With Resources</span></div>\n        <div><strong>${s.withCredentialRefs || 0}</strong><span>With Credential Refs</span></div>\n        <div><strong>${s.withBasicAuth || 0}</strong><span>With Basic</span></div>\n        <div><strong>${s.withSapCloudConnector || 0}</strong><span>With sapcc</span></div>\n        <div><strong>${s.interIflowLinks || 0}</strong><span>Inter-iFlow Links</span></div>\n        <div><strong>${s.oneToManyHubs || 0}</strong><span>One-to-Many Hubs</span></div>\n        <div><strong>${s.manyToOneHubs || 0}</strong><span>Many-to-One Hubs</span></div>\n      </div>\n    </section>
  `;
}

function renderAdapterInventory(model) {
  const packages = (model.integrations || []).map((entry) => entry.packageName || entry.packageId).filter(Boolean);
  const iflows = (model.integrations || []).map((entry) => entry.name || entry.id).filter(Boolean);
  const adapterTypes = (model.adapterInventory || []).map((entry) => entry.type).filter(Boolean);
  const rows = (Array.isArray(model.adapterInventory) ? model.adapterInventory : []).map((entry) => [
    entry.iflowName,
    entry.packageName,
    entry.direction,
    entry.type,
    entry.endpoint,
    entry.authMode,
    (entry.credentialRefs || []).join("; "),
    (entry.riskFlags || []).join(", ")
  ]);
  const table = renderTable(
    ["iFlow", "Package", "Direction", "Type", "Endpoint", "Auth", "Credential Refs", "Flags"],
    rows,
    { limit: DEFAULT_LIMIT, tableId: "adapter-inventory", emptyMessage: "No adapter inventory available." }
  );
  return `<section class="card"><h2>Adapter & Security Inventory</h2><p>Showing first ${DEFAULT_LIMIT} by default. Use Show all only when needed.</p><div class="section-filters" data-filter-target="adapter-inventory"><label><span>iFlow</span><select data-filter-col="0">${renderOptions(iflows, "All iFlows")}</select></label><label><span>Package</span><select data-filter-col="1">${renderOptions(packages, "All packages")}</select></label><label><span>Adapter</span><select data-filter-col="3">${renderOptions(adapterTypes, "All adapters")}</select></label><label class="section-filter-wide"><span>Search endpoint / flag / credential</span><input type="search" data-filter-global="1" placeholder="endpoint, auth, credential, flag..." /></label><button type="button" class="section-filter-reset">Reset</button></div>${table}</section>`;
}

function renderInterIflowLinks(model) {
  const links = Array.isArray(model.interIflowLinks) ? model.interIflowLinks : [];
  const producers = links.map((link) => link.fromName).filter(Boolean);
  const consumers = links.map((link) => link.toName).filter(Boolean);
  const adapters = links.map((link) => link.type).filter(Boolean);
  const rows = (Array.isArray(model.interIflowLinks) ? model.interIflowLinks : []).map((link) => [
    link.fromName,
    link.toName,
    link.type,
    link.endpoint,
    link.relation,
    link.authMode
  ]);
  const table = renderTable(
    ["Producer iFlow", "Consumer iFlow", "Adapter", "Shared Endpoint", "Relation", "Auth"],
    rows,
    { limit: DEFAULT_LIMIT, tableId: "inter-iflow-links", emptyMessage: "No explicit iFlow-to-iFlow links detected." }
  );
  return `<section class="card"><h2>Inter-iFlow Links</h2><p>Links are inferred from shared receiver/sender endpoints. Producer sends, consumer receives.</p><div class="section-filters" data-filter-target="inter-iflow-links"><label><span>Producer</span><select data-filter-col="0">${renderOptions(producers, "All producers")}</select></label><label><span>Consumer</span><select data-filter-col="1">${renderOptions(consumers, "All consumers")}</select></label><label><span>Adapter</span><select data-filter-col="2">${renderOptions(adapters, "All adapters")}</select></label><label><span>Endpoint</span><input type="search" data-filter-col="3" placeholder="filter endpoint" /></label><label><span>Relation</span><input type="search" data-filter-col="4" placeholder="direct call, queue..." /></label><button type="button" class="section-filter-reset">Reset</button></div>${table}</section>`;
}

function renderConnectionHubs(model) {
  const hubs = Array.isArray(model.connectionHubs) ? model.connectionHubs : [];
  const oneToManyCards = hubs.filter((hub) => hub.topology === "One-to-Many").map(renderHubCard);
  const manyToOneCards = hubs.filter((hub) => hub.topology === "Many-to-One").map(renderHubCard);

  return `
    <section class="card">
      <h2>Connection Topologies</h2>
      <p>Aggregated hubs where multiple flows share the same endpoint/queue.</p>
      <h3>One-to-Many</h3>
      <div class="section-filters" data-filter-target="hubs-one-to-many"><label><span>Adapter</span><input type="search" data-filter-col="0" placeholder="adapter" /></label><label><span>Endpoint</span><input type="search" data-filter-col="1" placeholder="endpoint" /></label><button type="button" class="section-filter-reset">Reset</button></div>
      ${renderHubCards(oneToManyCards, "hubs-one-to-many", "No one-to-many hubs detected.")}
      <h3>Many-to-One</h3>
      <div class="section-filters" data-filter-target="hubs-many-to-one"><label><span>Adapter</span><input type="search" data-filter-col="0" placeholder="adapter" /></label><label><span>Endpoint</span><input type="search" data-filter-col="1" placeholder="endpoint" /></label><button type="button" class="section-filter-reset">Reset</button></div>
      ${renderHubCards(manyToOneCards, "hubs-many-to-one", "No many-to-one hubs detected.")}
    </section>
  `;
}

function renderRelatedLinks(model, integration) {
  const related = (Array.isArray(model.interIflowLinks) ? model.interIflowLinks : []).filter(
    (link) => link.from === integration.id || link.to === integration.id
  );
  const rows = related.map((link) => [
    link.from === integration.id ? "Calls" : "Called By",
    link.from === integration.id ? link.toName : link.fromName,
    link.type,
    link.endpoint,
    link.relation
  ]);
  return renderTable(
    ["Direction", "Other iFlow", "Adapter", "Endpoint", "Relation"],
    rows,
    { limit: DEFAULT_LIMIT, emptyMessage: "No explicit inter-iFlow links detected for this iFlow." }
  );
}

function buildFlowOverview(integration) {
  const receivers = integration.adapters.filter((adapter) => /receiver/i.test(adapter.direction || ""));
  const senders = integration.adapters.filter((adapter) => /sender/i.test(adapter.direction || ""));
  return {
    inputCount: receivers.length,
    outputCount: senders.length,
    inputEndpoints: receivers.map((adapter) => adapter.endpoint).filter(Boolean),
    outputEndpoints: senders.map((adapter) => adapter.endpoint).filter(Boolean),
    internalStepCount: integration.internalSteps.length
  };
}

function buildSearchIndex(integration) {
  const parts = [
    integration.id,
    integration.name,
    integration.packageName,
    integration.packageId,
    ...(integration.adapters || []).flatMap((adapter) => [
      adapter.type,
      adapter.name,
      adapter.endpoint,
      adapter.system,
      adapter.authMode,
      ...(adapter.credentialRefs || [])
    ]),
    ...(integration.internalSteps || []).flatMap((step) => [
      step.name,
      step.stepType,
      step.reference,
      ...(step.details || [])
    ]),
    ...(integration.configurations || []).map((cfg) => cfg.key),
    ...(integration.resources || []).map((res) => res.path)
  ];
  return normalizeText(parts.join(" | "));
}

function renderIntegrations(model) {
  return model.integrations
    .map((integration) => {
      const overview = buildFlowOverview(integration);
      const adapters = renderTable(
        ["Direction", "Type", "Name", "System", "Endpoint", "Auth", "Credential Refs"],
        integration.adapters.map((adapter) => [
          adapter.direction,
          adapter.type,
          adapter.name,
          adapter.system,
          adapter.endpoint,
          adapter.authMode,
          (adapter.credentialRefs || []).join("; ")
        ]),
        { limit: DEFAULT_LIMIT, emptyMessage: "No adapters found." }
      );

      const variables = renderTable(
        ["Name", "Type", "Scope"],
        integration.variables.map((variable) => [variable.name, variable.type, variable.scope]),
        { limit: DEFAULT_LIMIT, emptyMessage: "No non-sensitive variables found." }
      );

      const configurations = renderTable(
        ["Key", "Value", "Data Type", "Required", "Secure", "Description"],
        integration.configurations.map((configuration) => [
          configuration.key,
          configuration.value,
          configuration.dataType,
          configuration.required ? "Yes" : "No",
          configuration.secure ? "Yes" : "No",
          configuration.description
        ]),
        { limit: DEFAULT_LIMIT, emptyMessage: "No configuration parameters found." }
      );

      const resources = renderTable(
        ["Name", "Type", "Size", "Unit", "Path"],
        integration.resources.map((resource) => [
          resource.name,
          resource.type,
          resource.size,
          resource.sizeUnit,
          resource.path
        ]),
        { limit: DEFAULT_LIMIT, emptyMessage: "No resources found." }
      );

      const flowSettings = renderTable(
        ["Setting", "Value"],
        integration.flowProperties.map((property) => [property.key, property.value]),
        { limit: DEFAULT_LIMIT, emptyMessage: "No global flow settings extracted." }
      );

      const internalSteps = renderInternalStepsTimeline(integration.internalSteps);

      const securityMaterialAliases = integration.securityDetails.credentialRefs || [];
      const externalizedSecureParams = integration.securityDetails.secureParameterKeys || [];
      const securitySummary = `
        <p><strong>Auth Modes:</strong> ${escapeHtml((integration.securityDetails.authModes || []).join(", ") || "None detected")}</p>
        <p><strong>User Roles:</strong> ${escapeHtml((integration.securityDetails.userRoles || []).join(", ") || "None detected")}</p>
        <p><strong>Security Material Aliases (CPI):</strong></p>
        ${renderList(securityMaterialAliases, "No Security Material alias reference detected.")}
        <p><strong>Externalized Parameters (secure):</strong></p>
        ${renderList(externalizedSecureParams, "No secure externalized parameter detected.")}
      `;

      const runtime = renderTable(
        ["Status", "Type", "Runtime Version", "Deployed By", "Deployed On"],
        integration.runtime
          ? [[
              integration.runtime.status,
              integration.runtime.type,
              integration.runtime.runtimeVersion,
              integration.runtime.deployedBy,
              integration.runtime.deployedOn
            ]]
          : [],
        { emptyMessage: "No runtime artifact found (possibly not deployed)." }
      );

      const dependencies = renderTable(
        ["Type", "Name", "Version"],
        integration.dependencies.map((dependency) => [dependency.type, dependency.name, dependency.version]),
        { limit: DEFAULT_LIMIT, emptyMessage: "No dependencies found." }
      );

      const cardClasses = ["card", "integration"];
      if (integration.flags.hasBasicAuth || integration.flags.hasSapCloudConnector) {
        cardClasses.push("integration-attention");
      } else if (integration.flags.hasCredentialRefs || integration.flags.hasSecureParameters) {
        cardClasses.push("integration-warning");
      }

      const packageName = integration.packageName || integration.packageId || "";
      const searchIndex = buildSearchIndex(integration);
      const topAdapters = integration.adapters.slice(0, 8);
      const topInputs = overview.inputEndpoints.slice(0, 6);
      const topOutputs = overview.outputEndpoints.slice(0, 6);
      const runtimeStatus = integration.runtime ? integration.runtime.status || "Deployed" : "Not deployed";
      const detailSections = [
        { title: "Endpoints & Adapters", content: adapters, open: true },
        { title: "Related iFlows", content: renderRelatedLinks(model, integration), open: false },
        { title: "Security Material & Externalized Security", content: securitySummary, open: false },
        { title: "Variables (Non-sensitive)", content: variables, open: false },
        { title: "Configured Parameters (Externalized Variables)", content: configurations, open: false },
        { title: "Resources", content: resources, open: false },
        { title: "Flow Settings", content: flowSettings, open: false },
        { title: "Internal Steps", content: internalSteps, open: false },
        { title: "Runtime Deployment", content: runtime, open: false },
        {
          title: "Error Handling",
          content: `<p><strong>Error Flow:</strong> ${integration.errorHandling.hasErrorFlow ? "Yes" : "No"}</p><p><strong>Retry Artifacts:</strong> ${escapeHtml((integration.errorHandling.retryArtifacts || []).join(", ") || "None")}</p>`,
          open: false
        },
        { title: "Dependencies", content: dependencies, open: false }
      ];

      return `
      <section class="${cardClasses.join(" ")}" id="iflow-${escapeHtml(integration.id)}" data-iflow="${escapeHtml(integration.name || integration.id)}" data-package="${escapeHtml(packageName)}" data-search="${escapeHtml(searchIndex)}">\n        <div class="integration-hero">\n          <div class="integration-title-wrap">\n            <div class="integration-kicker">${escapeHtml(packageName || "No package")}</div>\n            <h3>${escapeHtml(integration.name)} <small>${escapeHtml(integration.version)}</small></h3>\n            <p class="integration-meta-line"><strong>ID:</strong> ${escapeHtml(integration.id)} <span class="meta-separator">|</span> <strong>Runtime:</strong> ${escapeHtml(runtimeStatus)} <span class="meta-separator">|</span> <strong>Deployed By:</strong> ${escapeHtml(integration.deployedBy || "Unknown")}</p>\n          </div>\n          <div class="integration-side">\n            ${renderBadges(integration.flags)}\n            <p class="muted-inline"><strong>Modified:</strong> ${escapeHtml(integration.modifiedAt || "Unknown")}</p>\n          </div>\n        </div>\n        <div class="integration-summary-grid">\n          <div class="summary-pill"><strong>${overview.inputCount}</strong><span>Inputs</span></div>\n          <div class="summary-pill"><strong>${overview.outputCount}</strong><span>Outputs</span></div>\n          <div class="summary-pill"><strong>${overview.internalStepCount}</strong><span>Internal Steps</span></div>\n          <div class="summary-pill"><strong>${integration.dependencies.length}</strong><span>Dependencies</span></div>\n        </div>\n        <div class="integration-quick-grid">\n          <div class="quick-panel">\n            <h4>Input Endpoints</h4>\n            ${renderMiniChips(topInputs, "No input endpoints")}\n          </div>\n          <div class="quick-panel">\n            <h4>Output Endpoints</h4>\n            ${renderMiniChips(topOutputs, "No output endpoints")}\n          </div>\n          <div class="quick-panel">\n            <h4>Main Adapters</h4>\n            ${renderMiniChips(topAdapters, "No adapters found")}\n          </div>\n        </div>\n        <div class="integration-detail-stack">\n          ${detailSections.map((section) => `\n            <details ${section.open ? "open" : ""} class="detail-block">\n              <summary>${section.title}</summary>\n              <div class="detail-body">${section.content}</div>\n            </details>\n          `).join("")}\n        </div>\n      </section>
      `;
    })
    .join("\n");
}

function renderDependencyGraph(model) {
  const integrations = (model.integrations || []).map((entry) => entry.name || entry.id).filter(Boolean);
  const depTypes = (model.dependencyGraph || []).map((edge) => edge.type).filter(Boolean);
  const rows = model.dependencyGraph.map((edge) => [edge.from, edge.to, edge.type]);
  const table = renderTable(
    ["From iFlow", "To Artifact", "Type"],
    rows,
    { limit: DEFAULT_LIMIT, tableId: "dependency-graph", emptyMessage: "No dependency edges found." }
  );
  return `<section class="card"><h2>Dependency Map</h2><div class="section-filters" data-filter-target="dependency-graph"><label><span>iFlow</span><select data-filter-col="0">${renderOptions(integrations, "All iFlows")}</select></label><label><span>Type</span><select data-filter-col="2">${renderOptions(depTypes, "All types")}</select></label><label class="section-filter-wide"><span>Artifact</span><input type="search" data-filter-col="1" placeholder="mapping, script, xsd..." /></label><button type="button" class="section-filter-reset">Reset</button></div>${table}</section>`;
}

function renderClientScript() {
  const topicData = buildTopicDataset(arguments[0] || { integrations: [] });
  const serializedTopicData = JSON.stringify(topicData).replace(/</g, "\\u003c");
  return `
  <script>
    (function () {
      const TOPIC_DATA = ${serializedTopicData};
      const topicSortState = { key: 'iflow', direction: 'asc' };

      function applyTableLimit(tableShell) {
        const table = tableShell.querySelector('table');
        if (!table) {
          return;
        }

        const rows = Array.from(table.querySelectorAll('tbody tr[data-row]'));
        const matchedRows = rows.filter(function (row) {
          return row.getAttribute('data-filtered-out') !== '1';
        });
        const limit = Number.parseInt(tableShell.getAttribute('data-limit') || '', 10);
        const toggle = tableShell.querySelector('.table-toggle');
        const count = tableShell.querySelector('[data-count]');

        if (!Number.isFinite(limit) || limit <= 0 || matchedRows.length <= limit) {
          rows.forEach((row) => {
            row.style.display = row.getAttribute('data-filtered-out') === '1' ? 'none' : '';
          });
          if (toggle) {
            toggle.style.display = matchedRows.length > limit ? '' : 'none';
          }
          if (count) {
            count.textContent = matchedRows.length + ' rows';
          }
          return;
        }

        const expanded = toggle && toggle.getAttribute('data-expanded') === '1';
        let visible = 0;
        rows.forEach((row) => {
          if (row.getAttribute('data-filtered-out') === '1') {
            row.style.display = 'none';
            return;
          }

          if (expanded || visible < limit) {
            row.style.display = '';
            visible += 1;
          } else {
            row.style.display = 'none';
          }
        });

        if (count) {
          count.textContent = expanded
            ? ('Showing all ' + matchedRows.length + ' rows')
            : ('Showing first ' + limit + ' of ' + matchedRows.length + ' rows');
        }

        if (toggle) {
          toggle.textContent = expanded ? 'Show less' : 'Show all';
        }
      }

      function updateAllTables() {
        document.querySelectorAll('.table-shell').forEach(applyTableLimit);
      }

      function applySectionFilters(filterContainer) {
        if (!filterContainer) {
          return;
        }

        const targetId = filterContainer.getAttribute('data-filter-target');
        const shell = targetId ? document.getElementById(targetId) : null;
        if (!shell) {
          return;
        }

        const controls = Array.from(filterContainer.querySelectorAll('[data-filter-col], [data-filter-global]'));

        const rows = Array.from(shell.querySelectorAll('tbody tr[data-row]'));
        const cards = Array.from(shell.querySelectorAll('[data-filter-item="1"]'));

        if (rows.length === 0 && cards.length > 0) {
          cards.forEach(function (card) {
            const matches = controls.every(function (control) {
              const value = (control.value || '').trim().toLowerCase();
              if (!value) {
                return true;
              }

              const colIndex = control.getAttribute('data-filter-col');
              const haystack = (card.getAttribute('data-filter-' + colIndex) || '').toLowerCase();
              return haystack.includes(value);
            });
            card.style.display = matches ? '' : 'none';
          });
          return;
        }

        rows.forEach(function (row) {
          const cells = Array.from(row.querySelectorAll('td')).map(function (cell) {
            return (cell.textContent || '').toLowerCase();
          });

          const matches = controls.every(function (control) {
            const value = (control.value || '').trim().toLowerCase();
            if (!value) {
              return true;
            }

            if (control.hasAttribute('data-filter-global')) {
              return cells.join(' | ').includes(value);
            }

            const colIndex = Number.parseInt(control.getAttribute('data-filter-col') || '', 10);
            if (!Number.isFinite(colIndex)) {
              return true;
            }

            return (cells[colIndex] || '').includes(value);
          });

          row.setAttribute('data-filtered-out', matches ? '0' : '1');
        });

        const toggle = shell.querySelector('.table-toggle');
        if (toggle) {
          toggle.setAttribute('data-expanded', '0');
        }
        applyTableLimit(shell);
      }

      function initSectionFilters() {
        document.querySelectorAll('.section-filters').forEach(function (filterContainer) {
          const controls = filterContainer.querySelectorAll('[data-filter-col], [data-filter-global]');
          controls.forEach(function (control) {
            control.addEventListener('input', function () {
              applySectionFilters(filterContainer);
            });
            control.addEventListener('change', function () {
              applySectionFilters(filterContainer);
            });
          });

          const reset = filterContainer.querySelector('.section-filter-reset');
          if (reset) {
            reset.addEventListener('click', function () {
              controls.forEach(function (control) {
                control.value = '';
              });
              applySectionFilters(filterContainer);
            });
          }

          applySectionFilters(filterContainer);
        });
      }

      function getTopicValues(topic) {
        return (TOPIC_DATA.topics && TOPIC_DATA.topics[topic]) ? TOPIC_DATA.topics[topic] : [];
      }

      function populateTopicValues() {
        const topicField = document.getElementById('topic-field');
        const topicValue = document.getElementById('topic-value');
        if (!topicField || !topicValue) {
          return;
        }

        const values = getTopicValues(topicField.value);
        topicValue.innerHTML = values.map(function (value) {
          const safe = String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
          return '<option value="' + safe + '">' + safe + '</option>';
        }).join('');
      }

      function matchesTopic(entry, topic, value) {
        if (!value) {
          return false;
        }
        if (topic === 'credential') {
          return (entry.credentials || []).includes(value);
        }
        if (topic === 'package') {
          return entry.packageName === value;
        }
        if (topic === 'iflow') {
          return entry.name === value;
        }
        if (topic === 'adapter') {
          return (entry.adapterTypes || []).includes(value);
        }
        if (topic === 'endpoint') {
          return (entry.endpoints || []).includes(value);
        }
        if (topic === 'input') {
          return (entry.inputEndpoints || []).includes(value);
        }
        if (topic === 'output') {
          return (entry.outputEndpoints || []).includes(value);
        }
        if (topic === 'step') {
          return (entry.stepTypes || []).includes(value);
        }
        if (topic === 'process') {
          return (entry.processNames || []).includes(value);
        }
        if (topic === 'dependency') {
          return (entry.dependencyKeys || []).includes(value);
        }
        if (topic === 'runtime') {
          return entry.runtimeStatus === value;
        }
        if (topic === 'error') {
          return entry.errorMode === value;
        }
        if (topic === 'link') {
          return (entry.linkEndpoints || []).includes(value);
        }
        if (topic === 'flag') {
          return (entry.securityFlags || []).includes(value);
        }
        return false;
      }

      function compareTopicRows(left, right) {
        const key = topicSortState.key;
        const direction = topicSortState.direction === 'desc' ? -1 : 1;

        if (key === 'steps') {
          const a = Number(left.steps) || 0;
          const b = Number(right.steps) || 0;
          return (a - b) * direction;
        }

        const a = String(left[key] || '');
        const b = String(right[key] || '');
        return a.localeCompare(b) * direction;
      }

      function updateTopicSortHeaders() {
        document.querySelectorAll('.topic-sort-btn[data-topic-sort]').forEach(function (button) {
          const key = button.getAttribute('data-topic-sort');
          const active = key === topicSortState.key;
          const currentLabel = button.getAttribute('data-base-label') || button.textContent.replace(/\s+[▲▼]$/, '');
          const arrow = active ? (topicSortState.direction === 'asc' ? ' ▲' : ' ▼') : '';
          button.setAttribute('data-base-label', currentLabel);
          button.textContent = currentLabel + arrow;
          button.classList.toggle('topic-sort-active', active);
        });
      }

      function renderTopicResults() {
        const topicField = document.getElementById('topic-field');
        const topicValue = document.getElementById('topic-value');
        const tbody = document.getElementById('topic-results-body');
        const count = document.getElementById('topic-result-count');
        const shell = document.getElementById('topic-results-shell');
        if (!topicField || !topicValue || !tbody || !count || !shell) {
          return;
        }

        const topic = topicField.value;
        const value = topicValue.value;
        const rows = (TOPIC_DATA.entries || []).filter(function (entry) {
          return matchesTopic(entry, topic, value);
        });

        const mappedRows = rows.map(function (entry) {
          return {
            iflow: entry.name,
            package: entry.packageName || '',
            matched: topic + ': ' + value,
            inputs: (entry.inputs || []).slice(0, 3).join(', '),
            outputs: (entry.outputs || []).slice(0, 3).join(', '),
            steps: entry.internalStepCount
          };
        }).sort(compareTopicRows);

        tbody.innerHTML = mappedRows.map(function (entry, index) {
          return '<tr data-row="1" data-index="' + index + '">' +
            '<td>' + entry.iflow + '</td>' +
            '<td>' + entry.package + '</td>' +
            '<td>' + entry.matched + '</td>' +
            '<td>' + entry.inputs + '</td>' +
            '<td>' + entry.outputs + '</td>' +
            '<td>' + entry.steps + '</td>' +
          '</tr>';
        }).join('');

        count.textContent = rows.length + ' iFlow matched';
        const toggle = shell.querySelector('.table-toggle');
        if (toggle) {
          toggle.setAttribute('data-expanded', '0');
        }
        applyTableLimit(shell);
        updateTopicSortHeaders();
      }

      function applyFilters() {
        const searchInput = document.getElementById('filter-search');
        const packageSelect = document.getElementById('filter-package');
        const iflowSelect = document.getElementById('filter-iflow');
        const countLabel = document.getElementById('filter-count');
        const catalogIflow = document.getElementById('catalog-filter-iflow');
        const catalogPackage = document.getElementById('catalog-filter-package');
        const catalogCount = document.getElementById('catalog-filter-count');
        const search = (searchInput ? searchInput.value : '').trim().toLowerCase();
        const packageValue = packageSelect ? packageSelect.value : '';
        const iflowValue = iflowSelect ? iflowSelect.value : '';
        const catalogIflowValue = catalogIflow ? catalogIflow.value : '';
        const catalogPackageValue = catalogPackage ? catalogPackage.value : '';

        const cards = Array.from(document.querySelectorAll('.integration'));
        let visible = 0;

        cards.forEach((card) => {
          const cardSearch = (card.getAttribute('data-search') || '').toLowerCase();
          const cardPackage = card.getAttribute('data-package') || '';
          const cardIflow = card.getAttribute('data-iflow') || '';

          const matchesSearch = !search || cardSearch.includes(search);
          const matchesPackage = !packageValue || cardPackage === packageValue;
          const matchesIflow = !iflowValue || cardIflow === iflowValue;
          const matchesCatalogPackage = !catalogPackageValue || cardPackage === catalogPackageValue;
          const matchesCatalogIflow = !catalogIflowValue || cardIflow === catalogIflowValue;
          const show = matchesSearch && matchesPackage && matchesIflow && matchesCatalogPackage && matchesCatalogIflow;

          card.style.display = show ? '' : 'none';
          if (show) {
            visible += 1;
          }
        });

        if (countLabel) {
          countLabel.textContent = visible + ' iFlow visible';
        }
        if (catalogCount) {
          catalogCount.textContent = visible + ' iFlow in catalog';
        }
      }

      function activateTab(tabId) {
        const panels = Array.from(document.querySelectorAll('.tab-panel'));
        const buttons = Array.from(document.querySelectorAll('.tab-btn[data-tab-target]'));

        panels.forEach(function (panel) {
          const active = panel.id === tabId;
          panel.classList.toggle('tab-panel-active', active);
          panel.style.display = active ? '' : 'none';
          panel.setAttribute('aria-hidden', active ? 'false' : 'true');
        });

        buttons.forEach(function (button) {
          const active = button.getAttribute('data-tab-target') === tabId;
          button.classList.toggle('active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        updateAllTables();
      }

      function openTopicLink(target) {
        if (!target || !target.classList.contains('topic-link')) {
          return;
        }

        const href = target.getAttribute('href') || '';
        if (!href.startsWith('#')) {
          return;
        }

        const tabId = target.getAttribute('data-open-tab');
        if (tabId) {
          activateTab(tabId);
        }

        const sectionId = href.slice(1);
        const section = document.getElementById(sectionId);
        if (section) {
          setTimeout(function () {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 10);
        }
      }

      function applyHashRouting() {
        const hash = window.location.hash || '';
        if (!hash.startsWith('#')) {
          return;
        }

        const topicLink = document.querySelector('.topic-link[href="' + hash.replace(/"/g, '\\"') + '"]');
        if (topicLink) {
          openTopicLink(topicLink);
        }
      }

      document.addEventListener('click', function (event) {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const sortButton = target.closest('.topic-sort-btn[data-topic-sort]');
        if (sortButton) {
          const sortKey = sortButton.getAttribute('data-topic-sort');
          if (sortKey) {
            if (topicSortState.key === sortKey) {
              topicSortState.direction = topicSortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
              topicSortState.key = sortKey;
              topicSortState.direction = 'asc';
            }
            renderTopicResults();
          }
          return;
        }

        if (target.id === 'refresh-docs') {
          window.location.reload();
        }

        if (target.classList.contains('topic-link')) {
          event.preventDefault();
          openTopicLink(target);
        }

        if (target.classList.contains('table-toggle')) {
          const next = target.getAttribute('data-expanded') === '1' ? '0' : '1';
          target.setAttribute('data-expanded', next);
          const shell = target.closest('.table-shell');
          if (shell) {
            applyTableLimit(shell);
          }
        }

        if (target.id === 'filter-reset') {
          const searchInput = document.getElementById('filter-search');
          const packageSelect = document.getElementById('filter-package');
          const iflowSelect = document.getElementById('filter-iflow');
          if (searchInput) {
            searchInput.value = '';
          }
          if (packageSelect) {
            packageSelect.value = '';
          }
          if (iflowSelect) {
            iflowSelect.value = '';
          }
          applyFilters();
          updateAllTables();
        }

        if (target.id === 'topic-apply') {
          renderTopicResults();
        }

        if (target.id === 'topic-reset') {
          const topicField = document.getElementById('topic-field');
          if (topicField) {
            topicField.value = 'credential';
          }
          populateTopicValues();
          renderTopicResults();
        }

        if (target.id === 'catalog-filter-reset') {
          const catalogIflow = document.getElementById('catalog-filter-iflow');
          const catalogPackage = document.getElementById('catalog-filter-package');
          if (catalogIflow) {
            catalogIflow.value = '';
          }
          if (catalogPackage) {
            catalogPackage.value = '';
          }
          applyFilters();
        }

        if (target.classList.contains('tab-btn') && target.hasAttribute('data-tab-target')) {
          activateTab(target.getAttribute('data-tab-target'));
        }
      });

      ['filter-search', 'filter-package', 'filter-iflow', 'catalog-filter-iflow', 'catalog-filter-package'].forEach(function (id) {
        const element = document.getElementById(id);
        if (element) {
          element.addEventListener('input', applyFilters);
          element.addEventListener('change', applyFilters);
        }
      });

      const topicField = document.getElementById('topic-field');
      if (topicField) {
        topicField.addEventListener('change', function () {
          populateTopicValues();
          renderTopicResults();
        });
      }

      const topicValue = document.getElementById('topic-value');
      if (topicValue) {
        topicValue.addEventListener('change', function () {
          renderTopicResults();
        });
      }

      applyFilters();
      populateTopicValues();
      renderTopicResults();
      updateTopicSortHeaders();
      activateTab('tab-overview');
      initSectionFilters();
      updateAllTables();
      applyHashRouting();
    })();
  </script>
  `;
}

function renderHtml(model) {
  const generatedAt = escapeHtml(model.generatedAt);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SAP CPI Documentation</title>
  <style>
    :root {
      --bg: #f5f3eb;
      --card: #fffef8;
      --ink: #222222;
      --muted: #57534e;
      --border: #d6d3d1;
      --soft-warn: #fff7ed;
      --soft-danger: #fef2f2;
    }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 20% 0%, #fef3c7 0, transparent 30%),
        radial-gradient(circle at 80% 10%, #bfdbfe 0, transparent 25%),
        var(--bg);
    }
    header {
      padding: 2rem 1rem;
      background: linear-gradient(135deg, #134e4a 0%, #0f766e 60%, #14b8a6 100%);
      color: #ffffff;
    }
    .header-bar {
      max-width: 1360px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 1rem;
    }
    .header-actions {
      display: flex;
      flex-direction: column;
      align-items: end;
      gap: 0.45rem;
    }
    .header-actions button {
      font: inherit;
      border: 1px solid rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.12);
      color: #ffffff;
      border-radius: 999px;
      padding: 0.45rem 0.85rem;
      cursor: pointer;
      font-weight: 600;
      backdrop-filter: blur(6px);
    }
    .header-actions button:hover {
      background: rgba(255,255,255,0.2);
    }
    .header-actions small {
      color: rgba(255,255,255,0.85);
      text-align: right;
      max-width: 280px;
    }
    main {
      padding: 1rem;
      max-width: 1360px;
      margin: 0 auto;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem;
      margin: 0 0 1rem 0;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      animation: rise 260ms ease-in;
    }
    .integration-attention {
      border-color: #fecaca;
      background: var(--soft-danger);
    }
    .integration-warning {
      border-color: #fed7aa;
      background: var(--soft-warn);
    }
    .integration {
      overflow: hidden;
      position: relative;
    }
    .integration::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 4px;
      background: linear-gradient(90deg, #0f766e 0%, #14b8a6 45%, #f59e0b 100%);
      opacity: 0.9;
    }
    .integration details {
      margin: 0.6rem 0;
    }
    .integration-hero {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      margin-bottom: 1rem;
      padding-top: 0.35rem;
    }
    .integration-title-wrap h3 {
      margin: 0.2rem 0 0.45rem 0;
      font-size: 1.35rem;
      line-height: 1.15;
    }
    .integration-kicker {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      border-radius: 999px;
      padding: 0.22rem 0.6rem;
      background: #ecfeff;
      border: 1px solid #99f6e4;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #115e59;
    }
    .integration-meta-line {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }
    .meta-separator {
      margin: 0 0.4rem;
      color: #a8a29e;
    }
    .integration-side {
      display: flex;
      flex-direction: column;
      align-items: end;
      gap: 0.35rem;
      min-width: 210px;
    }
    .flag-caption {
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 700;
    }
    .integration-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.55rem;
      margin-bottom: 0.65rem;
    }
    .summary-pill {
      border-radius: 10px;
      border: 1px solid var(--border);
      background: linear-gradient(180deg, #ffffff 0%, #fafaf9 100%);
      padding: 0.55rem 0.65rem;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .summary-pill strong {
      font-size: 1.15rem;
      line-height: 1;
    }
    .summary-pill span {
      font-size: 0.78rem;
      color: var(--muted);
    }
    .integration-quick-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.55rem;
      margin-bottom: 0.7rem;
    }
    .quick-panel {
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid var(--border);
      padding: 0.55rem 0.65rem;
    }
    .quick-panel h4 {
      margin: 0 0 0.35rem 0;
      font-size: 0.84rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
    }
    .mini-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .mini-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.18rem 0.5rem;
      background: #f8fafc;
      border: 1px solid #dbe4ea;
      font-size: 0.76rem;
      line-height: 1.25;
      max-width: 100%;
      word-break: break-word;
    }
    .adapter-chip.adapter-api {
      background: #dbeafe;
      border-color: #93c5fd;
      color: #1e3a8a;
    }
    .adapter-chip.adapter-file {
      background: #fef3c7;
      border-color: #fcd34d;
      color: #92400e;
    }
    .adapter-chip.adapter-sap {
      background: #dcfce7;
      border-color: #86efac;
      color: #166534;
    }
    .adapter-chip.adapter-db {
      background: #ede9fe;
      border-color: #c4b5fd;
      color: #5b21b6;
    }
    .adapter-chip.adapter-msg {
      background: #ffe4e6;
      border-color: #fda4af;
      color: #9f1239;
    }
    .adapter-chip.adapter-other {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #334155;
    }
    .integration-detail-stack {
      display: grid;
      gap: 0.45rem;
    }
    .detail-block {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: rgba(255,255,255,0.88);
      overflow: hidden;
    }
    .detail-block summary {
      cursor: pointer;
      list-style: none;
      padding: 0.5rem 0.65rem;
      font-weight: 700;
      font-size: 0.83rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      background: linear-gradient(180deg, #fcfcfb 0%, #f7f5f2 100%);
      border-bottom: 1px solid transparent;
    }
    .detail-block[open] summary {
      border-bottom-color: var(--border);
    }
    .detail-block summary::-webkit-details-marker {
      display: none;
    }
    .detail-body {
      padding: 0.5rem 0.65rem 0.7rem 0.65rem;
      font-size: 0.9rem;
    }
    .muted-inline {
      margin: 0;
      color: var(--muted);
      font-size: 0.82rem;
    }
    .timeline-wrap {
      padding-left: 0.1rem;
    }
    .step-timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.4rem;
    }
    .step-item {
      display: grid;
      grid-template-columns: 12px 1fr;
      gap: 0.45rem;
      align-items: start;
      position: relative;
    }
    .step-item:not(:last-child)::after {
      content: "";
      position: absolute;
      left: 5px;
      top: 12px;
      bottom: -8px;
      width: 2px;
      background: #dbe4ea;
    }
    .step-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #14b8a6;
      margin-top: 2px;
      box-shadow: 0 0 0 2px #ccfbf1;
    }
    .step-title {
      margin: 0;
      font-size: 0.86rem;
      font-weight: 700;
      color: #0f172a;
    }
    .step-meta {
      margin: 0.1rem 0 0 0;
      font-size: 0.78rem;
      color: #64748b;
      word-break: break-word;
    }
    .timeline-more {
      margin: 0.35rem 0 0 0;
      font-size: 0.78rem;
      color: #64748b;
    }
    .summary-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
    .summary-grid div {
      background: #ecfeff;
      border: 1px solid #99f6e4;
      border-radius: 10px;
      padding: 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .filters-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr auto;
      gap: 0.75rem;
      align-items: end;
    }
    .topic-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.7rem;
    }
    .topic-link {
      display: block;
      text-decoration: none;
      color: #134e4a;
      border: 1px solid var(--border);
      background: #ffffff;
      border-radius: 10px;
      padding: 0.65rem 0.7rem;
      font-weight: 600;
    }
    .topic-link:hover {
      background: #f0fdfa;
    }
    .topic-explorer-grid {
      display: grid;
      grid-template-columns: 1fr 2fr auto;
      gap: 0.75rem;
      align-items: end;
    }
    .topic-explorer-grid label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.9rem;
    }
    .topic-explorer-grid select,
    .topic-explorer-grid button {
      font: inherit;
      padding: 0.5rem 0.6rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #ffffff;
    }
    .topic-actions {
      display: flex;
      gap: 0.5rem;
    }
    .topic-result-count {
      margin-top: 0.5rem;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .topic-sort-btn {
      font: inherit;
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 0;
      text-align: left;
      width: 100%;
      font-weight: 700;
    }
    .topic-sort-btn.topic-sort-active {
      color: #0f766e;
    }
    .tabs-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
    .tab-btn {
      font: inherit;
      border: 1px solid var(--border);
      background: #ffffff;
      border-radius: 999px;
      padding: 0.4rem 0.75rem;
      cursor: pointer;
      font-weight: 600;
      color: #134e4a;
    }
    .tab-btn.active {
      background: #134e4a;
      color: #ffffff;
      border-color: #134e4a;
    }
    .tab-panel {
      display: none;
    }
    .tab-panel-active {
      display: block;
    }
    .no-js-message {
      margin: 0.25rem 0 0.75rem 0;
      font-size: 0.88rem;
      color: var(--muted);
    }
    .filters-grid label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.9rem;
    }
    .filters-grid input,
    .filters-grid select,
    .filters-grid button {
      font: inherit;
      padding: 0.5rem 0.6rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #ffffff;
    }
    .filters-actions {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      white-space: nowrap;
    }
    .section-filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.65rem;
      align-items: end;
      margin: 0.75rem 0;
    }
    .section-filters label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.88rem;
    }
    .section-filters input,
    .section-filters select,
    .section-filters button {
      font: inherit;
      padding: 0.45rem 0.55rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #ffffff;
    }
    .section-filter-wide {
      grid-column: span 2;
    }
    .hub-list {
      display: grid;
      gap: 0.85rem;
      margin-top: 0.5rem;
    }
    .hub-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      padding: 0.85rem;
    }
    .hub-card-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      margin-bottom: 0.75rem;
    }
    .hub-card-header h4 {
      margin: 0;
    }
    .hub-card-header p {
      margin: 0.2rem 0 0 0;
    }
    .hub-endpoint {
      color: var(--muted);
      word-break: break-word;
    }
    .hub-stats {
      display: flex;
      flex-wrap: wrap;
      justify-content: end;
      gap: 0.35rem;
    }
    .hub-stats span {
      border-radius: 999px;
      border: 1px solid var(--border);
      padding: 0.2rem 0.5rem;
      background: #f8fafc;
      font-size: 0.82rem;
      white-space: nowrap;
    }
    .hub-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    .hub-column h5 {
      margin: 0 0 0.45rem 0;
      font-size: 0.92rem;
    }
    .hub-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .hub-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.22rem 0.55rem;
      background: #f0fdfa;
      border: 1px solid #bae6fd;
      font-size: 0.83rem;
      line-height: 1.2;
      word-break: break-word;
      max-width: 100%;
    }
    .hub-chip-more {
      background: #fafaf9;
      border-color: #d6d3d1;
      color: var(--muted);
    }
    .badges {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
      margin: 0.1rem 0 0.2rem 0;
    }
    .badge {
      border-radius: 7px;
      padding: 0.13rem 0.4rem;
      font-size: 0.7rem;
      font-weight: 700;
      border: 1px solid transparent;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-basic {
      color: #991b1b;
      background: #fee2e2;
      border-color: #fca5a5;
    }
    .badge-sapcc {
      color: #9a3412;
      background: #ffedd5;
      border-color: #fdba74;
    }
    .badge-cred {
      color: #1d4ed8;
      background: #dbeafe;
      border-color: #93c5fd;
    }
    .badge-secure {
      color: #166534;
      background: #dcfce7;
      border-color: #86efac;
    }
    .table-shell {
      margin-top: 0.5rem;
    }
    .table-wrap {
      width: 100%;
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #ffffff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 820px;
      table-layout: fixed;
    }
    th, td {
      padding: 0.55rem;
      border-bottom: 1px solid var(--border);
      text-align: left;
      font-size: 0.92rem;
      vertical-align: top;
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    th {
      background: #f0fdfa;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .table-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.6rem;
      margin-top: 0.4rem;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .table-meta button {
      font: inherit;
      border: 1px solid var(--border);
      background: #ffffff;
      border-radius: 8px;
      padding: 0.3rem 0.55rem;
      cursor: pointer;
    }
    ul {
      margin: 0.5rem 0 0 1rem;
      padding: 0;
    }
    li {
      margin: 0.2rem 0;
    }
    small {
      color: var(--muted);
    }
    @media (max-width: 900px) {
      .filters-grid {
        grid-template-columns: 1fr;
      }
      .topic-explorer-grid {
        grid-template-columns: 1fr;
      }
      .integration-hero {
        flex-direction: column;
      }
      .integration-side {
        align-items: start;
        min-width: 0;
      }
      .integration-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .integration-quick-grid {
        grid-template-columns: 1fr;
      }
      .hub-columns {
        grid-template-columns: 1fr;
      }
      .hub-card-header {
        flex-direction: column;
      }
      .hub-stats {
        justify-content: start;
      }
      .header-bar {
        flex-direction: column;
      }
      .header-actions {
        align-items: start;
      }
      main {
        padding: 0.75rem;
      }
    }
    @keyframes rise {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-bar">
      <div>
        <h1>SAP CPI Technical Documentation</h1>
        <p>Generated at ${generatedAt}</p>
      </div>
      <div class="header-actions">
        <button id="refresh-docs" type="button">Refresh Documentation</button>
        <small>Reloads the generated HTML currently on disk after a new generation.</small>
      </div>
    </div>
  </header>
  <main>
    ${renderSectionTabs()}
    <section class="tab-panel tab-panel-active" id="tab-overview" aria-hidden="false">
      ${renderSummary(model)}
      ${renderTopicMenu()}
      ${renderFilterControls(model)}
      ${renderTopicExplorer()}
    </section>
    <section class="tab-panel" id="tab-security" aria-hidden="true">
      ${renderAdapterInventory(model)}
    </section>
    <section class="tab-panel" id="tab-connectivity" aria-hidden="true">
      <div id="inter-iflow-section">${renderInterIflowLinks(model)}</div>
      <div id="hubs-section">${renderConnectionHubs(model)}</div>
    </section>
    <section class="tab-panel" id="tab-internals" aria-hidden="true">
      <div id="dependency-section">${renderDependencyGraph(model)}</div>
      <section class="card" id="iflow-catalog">
        <h2>iFlow Catalog</h2>
        <p>Ordered by security/attention flags first, then by name. Large sections are limited to ${DEFAULT_LIMIT} rows by default.</p>
        ${renderCatalogFilters(model)}
      </section>
      ${renderIntegrations(model)}
    </section>
  </main>
  ${renderClientScript(model)}
</body>
</html>`;
}

module.exports = {
  renderHtml
};
