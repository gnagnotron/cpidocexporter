const axios = require("axios");
const AdmZip = require("adm-zip");
const { XMLParser } = require("fast-xml-parser");
const logger = require("../core/logger");

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getToken(config, metrics) {
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", config.sap.clientId);
  params.append("client_secret", config.sap.clientSecret);

  metrics.apiCalls += 1;
  const response = await axios.post(config.sap.tokenUrl, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: config.sap.timeoutMs
  });

  if (!response.data || !response.data.access_token) {
    throw new Error("OAuth token response missing access_token");
  }

  return response.data.access_token;
}

async function requestWithRetry(client, requestConfig, config, metrics) {
  let attempt = 0;
  let lastError;

  while (attempt <= config.sap.maxRetries) {
    try {
      metrics.apiCalls += 1;
      return await client.request(requestConfig);
    } catch (error) {
      lastError = error;
      const status = error.response ? error.response.status : null;
      const retryable = !status || status === 429 || [500, 502, 503, 504].includes(status);
      if (!retryable || attempt === config.sap.maxRetries) {
        break;
      }

      attempt += 1;
      metrics.retries += 1;
      const backoffMs = 500 * 2 ** (attempt - 1);
      logger.warn("Retrying SAP API request", {
        url: requestConfig.url,
        status,
        attempt,
        backoffMs
      });
      await sleep(backoffMs);
    }
  }

  throw lastError;
}

function ensureApiPayload(response, requestUrl) {
  const contentType = response.headers && response.headers["content-type"]
    ? String(response.headers["content-type"]).toLowerCase()
    : "";

  if (contentType.includes("text/html")) {
    throw new Error(
      `Unexpected HTML response from SAP API for ${requestUrl}. ` +
      "This usually means the base URL points to an approuter/UI endpoint or the bearer token is not accepted for that route."
    );
  }

  if (typeof response.data === "string" && /^\s*<html/i.test(response.data)) {
    throw new Error(
      `Unexpected HTML response from SAP API for ${requestUrl}. ` +
      "This usually means the base URL points to an approuter/UI endpoint or the bearer token is not accepted for that route."
    );
  }

  return response;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value == null ? [] : [value];
}

function getNodeText(node) {
  if (node == null) {
    return "";
  }

  if (["string", "number", "boolean"].includes(typeof node)) {
    return String(node);
  }

  if (typeof node === "object") {
    if (Object.prototype.hasOwnProperty.call(node, "#text")) {
      return String(node["#text"] || "");
    }
    if (Object.prototype.hasOwnProperty.call(node, "__text")) {
      return String(node.__text || "");
    }
    const keys = Object.keys(node);
    if (keys.length === 1) {
      return getNodeText(node[keys[0]]);
    }
  }

  return "";
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      values
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );
}

function uniqueBy(items, keySelector) {
  const seen = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = keySelector(item);
    if (!seen.has(key)) {
      seen.set(key, item);
      continue;
    }

    const existing = seen.get(key);
    seen.set(key, {
      ...existing,
      ...item,
      properties: uniqueStrings([...(existing.properties || []), ...(item.properties || [])]),
      credentialRefs: uniqueStrings([...(existing.credentialRefs || []), ...(item.credentialRefs || [])])
    });
  }
  return Array.from(seen.values());
}

function mapExtensionProperties(node) {
  const extensionElements = node && node["bpmn2:extensionElements"];
  const mapped = {};

  for (const property of toArray(extensionElements && extensionElements["ifl:property"])) {
    const key = getNodeText(property.key || property["ifl:key"]);
    const value = getNodeText(property.value || property["ifl:value"]);
    if (key) {
      mapped[key] = value;
    }
  }

  return mapped;
}

function isSensitiveValueKey(key) {
  return /pass|secret|token|private|apikey|api_key/i.test(String(key || ""));
}

function summarizeProtectedValue(key, value) {
  if (!value) {
    return "";
  }

  if (isSensitiveValueKey(key)) {
    return "***";
  }

  if (/username|user$/i.test(String(key || ""))) {
    return "[configured]";
  }

  return String(value);
}

function extractODataResults(payload) {
  return payload && payload.d && Array.isArray(payload.d.results)
    ? payload.d.results
    : [];
}

function buildPagedUrl(basePath, top, skip) {
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}$format=json&$top=${top}&$skip=${skip}`;
}

async function fetchPagedOData(client, basePath, config, metrics) {
  const allResults = [];
  let skip = 0;
  const top = config.sap.pageSize;

  while (true) {
    const requestUrl = buildPagedUrl(basePath, top, skip);
    const resp = ensureApiPayload(
      await requestWithRetry(
        client,
        {
          method: "GET",
          url: requestUrl
        },
        config,
        metrics
      ),
      requestUrl
    );

    const page = extractODataResults(resp.data);
    if (page.length === 0) {
      break;
    }

    allResults.push(...page);
    if (page.length < top) {
      break;
    }
    skip += top;
  }

  return allResults;
}

async function tryFetchPagedOData(client, basePath, config, metrics, contextLabel) {
  try {
    return await fetchPagedOData(client, basePath, config, metrics);
  } catch (error) {
    const status = error.response ? error.response.status : null;
    if (status === 501 || status === 404) {
      return [];
    }
    throw error;
  }
}

function isSensitiveKey(key) {
  return /pass|secret|token|credential|private|apikey|api_key/i.test(String(key || ""));
}

function isAliasLikeConfiguration(key, value) {
  const safeKey = String(key || "");
  const safeValue = String(value || "");
  const keySuggestsAlias = /(credential|cred|alias|reference|ref|security.?material)/i.test(safeKey);
  const valueLooksAlias = /^[A-Za-z][A-Za-z0-9_.:-]{1,120}$/.test(safeValue);
  const valueLooksSecret = /(-----BEGIN|\s|=|\/\+|[A-Fa-f0-9]{32,}|eyJ[A-Za-z0-9_-]{8,})/.test(safeValue);
  return keySuggestsAlias && valueLooksAlias && !valueLooksSecret;
}

function shouldMaskConfigurationValue(key, value) {
  if (!isSensitiveKey(key)) {
    return false;
  }
  if (isAliasLikeConfiguration(key, value)) {
    return false;
  }
  return true;
}

function normalizeConfigurations(configRows) {
  return (Array.isArray(configRows) ? configRows : []).map((row) => {
    const key = row.ParameterKey || "";
    const rawValue = String(row.ParameterValue || "");
    const secure = shouldMaskConfigurationValue(key, rawValue);
    return {
      key,
      dataType: row.DataType || "string",
      description: row.Description || "",
      value: secure ? "***" : rawValue,
      secure
    };
  });
}

function normalizeResources(resourceRows) {
  return (Array.isArray(resourceRows) ? resourceRows : []).map((row) => ({
    name: row.Name || "",
    type: row.ResourceType || "",
    referencedType: row.ReferencedResourceType || "",
    size: row.ResourceSize || "",
    sizeUnit: row.ResourceSizeUnit || "",
    path: row.Path || row.Name || ""
  }));
}

function inferResourceTypeFromEntry(entryName) {
  const normalized = String(entryName || "").toLowerCase();
  const ext = normalized.includes(".") ? normalized.split(".").pop() : "";

  const extMap = {
    groovy: "Groovy Script",
    js: "JavaScript",
    mmap: "Message Mapping",
    xsd: "XSD",
    wsdl: "WSDL",
    xslt: "XSLT",
    xsl: "XSLT",
    jar: "JAR",
    xml: "XML",
    json: "JSON",
    csv: "CSV",
    edmx: "EDMX"
  };

  return extMap[ext] || (ext ? ext.toUpperCase() : "Artifact File");
}

function shouldIncludeZipEntry(entryName) {
  return !/^(\.project|META-INF\/MANIFEST\.MF|metainfo\.prop|src\/main\/resources\/parameters\.prop|src\/main\/resources\/parameters\.propdef|src\/main\/resources\/scenarioflows\/integrationflow\/.+\.iflw)$/i.test(
    String(entryName || "")
  );
}

function parseJavaProperties(content) {
  const result = {};

  for (const line of String(content || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) {
      result[key] = value;
    }
  }

  return result;
}

function parseParameterDefinitions(content) {
  if (!content) {
    return [];
  }

  try {
    const xml = xmlParser.parse(content);
    const root = xml.parameters || {};
    return toArray(root.parameter).map((parameter) => ({
      key: getNodeText(parameter.key),
      name: getNodeText(parameter.name),
      type: getNodeText(parameter.type) || "xsd:string",
      required: /true/i.test(getNodeText(parameter.isRequired)),
      description: getNodeText(parameter.description)
    }));
  } catch (error) {
    logger.warn("Failed to parse parameter definitions from artifact", { error: error.message });
    return [];
  }
}

function extractCmdVariantName(cmdVariantUri) {
  const match = String(cmdVariantUri || "").match(/cname::([^/]+)/i);
  return match ? match[1] : "";
}

function inferDirection(props, sourceParticipant, targetParticipant) {
  if (props.direction) {
    return props.direction;
  }
  const sourceType = sourceParticipant && sourceParticipant.type;
  const targetType = targetParticipant && targetParticipant.type;
  if (/sender/i.test(sourceType || "")) {
    return "Sender";
  }
  if (/receiv/i.test(targetType || "")) {
    return "Receiver";
  }
  return "";
}

function buildAdapterFromMessageFlow(flow, participantMap) {
  const props = mapExtensionProperties(flow);
  const sourceParticipant = participantMap.get(flow["@_sourceRef"]);
  const targetParticipant = participantMap.get(flow["@_targetRef"]);
  const credentialRefs = Object.entries(props)
    .filter(([key, value]) => /credential|alias|certificate|keystore|role|oauth|auth|locationid|proxy/i.test(key) && value)
    .map(([key, value]) => `${key}=${summarizeProtectedValue(key, value)}`);

  const interestingProperties = Object.entries(props)
    .filter(([key, value]) => /url|address|queue|auth|role|certificate|proxy|locationid|deadletter|retry|max|timeout|xsrf/i.test(key) && value)
    .map(([key, value]) => `${key}=${summarizeProtectedValue(key, value)}`);

  return {
    type: firstNonEmpty([props.ComponentType, props.Name]),
    name: firstNonEmpty([flow["@_name"], props.Name, flow["@_id"]]),
    direction: inferDirection(props, sourceParticipant, targetParticipant),
    system: firstNonEmpty([props.system, sourceParticipant && sourceParticipant.name, targetParticipant && targetParticipant.name]),
    endpoint: firstNonEmpty([
      props.urlPath,
      props.address,
      props.QueueName_inbound,
      props.QueueName_outbound,
      props.queueName,
      props.queue,
      props.host,
      props.url
    ]),
    transport: props.TransportProtocol || "",
    messageProtocol: props.MessageProtocol || "",
    authMode: firstNonEmpty([
      props.senderAuthType,
      props.authentication,
      props.authType,
      props.AuthType,
      props.enableBasicAuthentication === "true" ? "BasicEnabled" : ""
    ]),
    credentialRefs,
    properties: interestingProperties
  };
}

function buildFlowProperties(collaborationNode) {
  const props = mapExtensionProperties(collaborationNode);
  return Object.entries(props)
    .filter(([key, value]) => /httpSessionHandling|returnExceptionToSender|log|corsEnabled|allowed|accessControl|ServerTrace|namespaceMapping|exposedHeaders/i.test(key) && value !== "")
    .map(([key, value]) => ({ key, value: summarizeProtectedValue(key, value) }));
}

function buildInternalSteps(definitionsNode) {
  const processes = toArray(definitionsNode["bpmn2:process"]);
  const ignoredTags = new Set([
    "bpmn2:extensionElements",
    "bpmn2:sequenceFlow",
    "bpmn2:startEvent",
    "bpmn2:endEvent",
    "bpmn2:incoming",
    "bpmn2:outgoing",
    "bpmn2:laneSet",
    "bpmn2:textAnnotation"
  ]);
  const steps = [];

  for (const processNode of processes) {
    const processName = firstNonEmpty([processNode["@_name"], processNode["@_id"]]);
    for (const [tagName, rawNodes] of Object.entries(processNode)) {
      if (!tagName.startsWith("bpmn2:") || ignoredTags.has(tagName)) {
        continue;
      }

      for (const node of toArray(rawNodes)) {
        if (!node || typeof node !== "object" || !node["@_id"]) {
          continue;
        }

        const props = mapExtensionProperties(node);
        const stepType = firstNonEmpty([
          props.ComponentType,
          props.activityType,
          props.subActivityType,
          extractCmdVariantName(props.cmdVariantUri),
          tagName.replace("bpmn2:", "")
        ]);
        const details = Object.entries(props)
          .filter(([key, value]) => /processId|resource|mapping|script|address|url|condition|type|operation|function/i.test(key) && value)
          .map(([key, value]) => `${key}=${summarizeProtectedValue(key, value)}`);

        if (!stepType && !node["@_name"] && details.length === 0) {
          continue;
        }

        steps.push({
          process: processName,
          id: node["@_id"],
          name: node["@_name"] || "",
          bpmnType: tagName.replace("bpmn2:", ""),
          stepType,
          reference: firstNonEmpty([
            props.processId,
            props.resourceUri,
            props.resource,
            props.mapping,
            props.script,
            props.scriptName,
            props.address,
            props.urlPath,
            props.operationName
          ]),
          details
        });
      }
    }
  }

  return steps;
}

function buildSecurityDetails(adapters, configurations) {
  return {
    credentialRefs: uniqueStrings(
      adapters.flatMap((adapter) => adapter.credentialRefs || [])
    ),
    authModes: uniqueStrings(adapters.map((adapter) => adapter.authMode)),
    userRoles: uniqueStrings(
      adapters.flatMap((adapter) =>
        (adapter.properties || [])
          .filter((entry) => entry.startsWith("userRole="))
          .map((entry) => entry.slice("userRole=".length))
      )
    ),
    secureParameterKeys: uniqueStrings(
      (Array.isArray(configurations) ? configurations : [])
        .filter((configuration) => configuration.secure)
        .map((configuration) => configuration.key)
    )
  };
}

function parseArchiveConfigurations(entries) {
  const propsEntry = entries.find((entry) => /src\/main\/resources\/parameters\.prop$/i.test(entry.entryName));
  const defsEntry = entries.find((entry) => /src\/main\/resources\/parameters\.propdef$/i.test(entry.entryName));
  const valuesByKey = parseJavaProperties(propsEntry ? propsEntry.getData().toString("utf8") : "");
  const definitions = parseParameterDefinitions(defsEntry ? defsEntry.getData().toString("utf8") : "");
  const results = definitions.map((definition) => {
    const key = firstNonEmpty([definition.name, definition.key]);
    const rawValue = String(valuesByKey[key] || "");
    const secure = shouldMaskConfigurationValue(key, rawValue);
    return {
      key,
      dataType: definition.type || "xsd:string",
      description: definition.description || "",
      value: secure ? "***" : rawValue,
      secure,
      required: Boolean(definition.required)
    };
  });

  for (const [key, value] of Object.entries(valuesByKey)) {
    if (results.some((item) => item.key === key)) {
      continue;
    }
    const rawValue = String(value || "");
    const secure = shouldMaskConfigurationValue(key, rawValue);
    results.push({
      key,
      dataType: "xsd:string",
      description: "",
      value: secure ? "***" : rawValue,
      secure,
      required: false
    });
  }

  return results;
}

function parseArchiveResources(entries) {
  return entries
    .filter((entry) => !entry.isDirectory && shouldIncludeZipEntry(entry.entryName))
    .map((entry) => ({
      name: entry.entryName.split("/").pop() || entry.entryName,
      type: inferResourceTypeFromEntry(entry.entryName),
      referencedType: "artifact-zip-entry",
      size: entry.header && typeof entry.header.size === "number" ? entry.header.size : entry.getData().length,
      sizeUnit: "bytes",
      path: entry.entryName
    }));
}

function parseArtifactArchive(buffer) {
  const zip = new AdmZip(Buffer.from(buffer));
  const entries = zip.getEntries();
  const iflwEntry = entries.find((entry) => /src\/main\/resources\/scenarioflows\/integrationflow\/.+\.iflw$/i.test(entry.entryName));

  if (!iflwEntry) {
    return {
      adapters: [],
      configurations: parseArchiveConfigurations(entries),
      resources: parseArchiveResources(entries),
      flowProperties: [],
      internalSteps: [],
      securityDetails: { credentialRefs: [], authModes: [], userRoles: [], secureParameterKeys: [] }
    };
  }

  const xml = xmlParser.parse(iflwEntry.getData().toString("utf8"));
  const definitionsNode = xml["bpmn2:definitions"] || xml;
  const collaborationNode = toArray(definitionsNode["bpmn2:collaboration"])[0] || {};
  const participants = toArray(collaborationNode["bpmn2:participant"]);
  const participantMap = new Map(
    participants.map((participant) => [
      participant["@_id"],
      {
        id: participant["@_id"],
        name: participant["@_name"] || "",
        type: firstNonEmpty([participant["@_ifl:type"], mapExtensionProperties(participant)["ifl:type"]])
      }
    ])
  );

  const adapters = toArray(collaborationNode["bpmn2:messageFlow"])
    .map((flow) => buildAdapterFromMessageFlow(flow, participantMap))
    .filter((adapter) => adapter.type || adapter.name || adapter.endpoint);
  const configurations = parseArchiveConfigurations(entries);
  const resources = parseArchiveResources(entries);
  const flowProperties = buildFlowProperties(collaborationNode);
  const internalSteps = buildInternalSteps(definitionsNode);
  const securityDetails = buildSecurityDetails(adapters, configurations);

  return {
    adapters,
    configurations,
    resources,
    flowProperties,
    internalSteps,
    securityDetails
  };
}

function mergeConfigurations(primary, secondary) {
  const merged = new Map();
  for (const item of [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]) {
    if (!item || !item.key) {
      continue;
    }
    const existing = merged.get(item.key) || {};
    merged.set(item.key, {
      ...existing,
      ...item,
      description: firstNonEmpty([existing.description, item.description]),
      dataType: firstNonEmpty([existing.dataType, item.dataType]),
      value: firstNonEmpty([existing.value, item.value]),
      secure: Boolean(existing.secure || item.secure)
    });
  }
  return Array.from(merged.values());
}

function mergeResources(primary, secondary) {
  return uniqueBy([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])], (resource) => `${resource.path || resource.name}|${resource.type}`);
}

function mergeAdapters(primary, secondary) {
  return uniqueBy([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])], (adapter) => `${adapter.direction || ""}|${adapter.type || ""}|${adapter.name || ""}|${adapter.endpoint || ""}`);
}

function extractDependencies(resources) {
  return resources
    .filter((res) => /mmap|xslt|xsd|wsdl|script|groovy|jar|js/i.test(res.type || ""))
    .map((res) => ({
      type: res.type,
      name: res.name,
      version: ""
    }));
}

function parseEndpointFromServiceId(serviceId) {
  const match = String(serviceId || "").match(/\$endpointAddress=(.+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function mapServiceEndpointsForIflow(iflow, serviceEndpoints) {
  const flowId = iflow.Id || "";
  const flowName = iflow.Name || "";

  return (Array.isArray(serviceEndpoints) ? serviceEndpoints : [])
    .filter((ep) => {
      const epName = ep.Name || "";
      const epId = ep.Id || "";
      return epName === flowName || epId.startsWith(`${flowId}$`) || epId.startsWith(`${flowName}$`);
    })
    .map((ep) => ({
      type: ep.Protocol || "",
      name: ep.Name || ep.Id || "",
      direction: "Sender",
      system: ep.Name || "",
      endpoint: parseEndpointFromServiceId(ep.Id),
      transport: ep.Protocol || "",
      messageProtocol: "",
      authMode: "",
      credentialRefs: [],
      properties: []
    }));
}

function extractErrorHandling(resources, configurations) {
  const retryFromResources = resources
    .filter((res) => /retry|exception|error/i.test(res.name || ""))
    .map((res) => res.name);

  const retryFromConfig = configurations
    .filter((cfg) => /retry|error|exception/i.test(cfg.key || ""))
    .map((cfg) => cfg.key);

  const retryArtifacts = Array.from(new Set([...retryFromResources, ...retryFromConfig]));
  return {
    hasErrorFlow: retryArtifacts.length > 0,
    retryArtifacts
  };
}

async function fetchIflowDetails(client, iflow, serviceEndpoints, runtimeById, config, metrics) {
  const encodedId = encodeURIComponent(iflow.Id);
  const encodedVersion = encodeURIComponent(iflow.Version);

  const configurations = normalizeConfigurations(
    await tryFetchPagedOData(
      client,
      `/api/v1/IntegrationDesigntimeArtifacts(Id='${encodedId}',Version='${encodedVersion}')/Configurations`,
      config,
      metrics,
      `${iflow.Id}:${iflow.Version}:Configurations`
    )
  );

  const resources = normalizeResources(
    await tryFetchPagedOData(
      client,
      `/api/v1/IntegrationDesigntimeArtifacts(Id='${encodedId}',Version='${encodedVersion}')/Resources`,
      config,
      metrics,
      `${iflow.Id}:${iflow.Version}:Resources`
    )
  );

  let archiveDetails = {
    adapters: [],
    configurations: [],
    resources: [],
    flowProperties: [],
    internalSteps: [],
    securityDetails: { credentialRefs: [], authModes: [], userRoles: [], secureParameterKeys: [] }
  };

  try {
    const archiveResponse = await requestWithRetry(
      client,
      {
        method: "GET",
        url: `/api/v1/IntegrationDesigntimeArtifacts(Id='${encodedId}',Version='${encodedVersion}')/$value`,
        responseType: "arraybuffer",
        headers: {
          Accept: "application/zip, application/octet-stream"
        }
      },
      config,
      metrics
    );
    archiveDetails = parseArtifactArchive(archiveResponse.data);
  } catch (error) {
    const status = error.response ? error.response.status : null;
    if (status !== 404 && status !== 501) {
      logger.warn("Artifact ZIP fetch failed", {
        iflowId: iflow.Id,
        version: iflow.Version,
        status,
        error: error.message
      });
    }
  }

  const mergedConfigurations = mergeConfigurations(configurations, archiveDetails.configurations);
  const mergedResources = mergeResources(resources, archiveDetails.resources);
  const adapters = mergeAdapters(archiveDetails.adapters, mapServiceEndpointsForIflow(iflow, serviceEndpoints));
  const runtime = runtimeById.get(iflow.Id) || null;
  const securityDetails = buildSecurityDetails(adapters, mergedConfigurations);

  return {
    variables: mergedConfigurations.map((cfg) => ({
      name: cfg.key,
      type: cfg.dataType,
      scope: "configuration",
      secure: cfg.secure
    })),
    configurations: mergedConfigurations,
    resources: mergedResources,
    adapters,
    dependencies: extractDependencies(mergedResources),
    errorHandling: extractErrorHandling(mergedResources, mergedConfigurations),
    flowProperties: archiveDetails.flowProperties,
    internalSteps: archiveDetails.internalSteps,
    securityDetails,
    runtime: runtime
      ? {
          status: runtime.Status || "",
          type: runtime.Type || "",
          deployedBy: runtime.DeployedBy || "",
          deployedOn: runtime.DeployedOn || "",
          runtimeVersion: runtime.Version || ""
        }
      : null
  };
}

async function fetchAllIflows(config, metrics) {
  const clientOptions = {
    baseURL: config.sap.cpiBaseUrl,
    timeout: config.sap.timeoutMs,
    headers: {
      Accept: "application/json"
    }
  };

  if (config.sap.authMode === "basic") {
    clientOptions.auth = {
      username: config.sap.basicUsername,
      password: config.sap.basicPassword
    };
  } else {
    const token = await getToken(config, metrics);
    clientOptions.headers.Authorization = `Bearer ${token}`;
  }

  const client = axios.create(clientOptions);

  const packages = await fetchPagedOData(client, "/api/v1/IntegrationPackages", config, metrics);

  logger.info("Fetched integration packages", { count: packages.length });

  const serviceEndpoints = await fetchPagedOData(client, "/api/v1/ServiceEndpoints", config, metrics);
  logger.info("Fetched service endpoints", { count: serviceEndpoints.length });

  const runtimeArtifacts = await fetchPagedOData(client, "/api/v1/IntegrationRuntimeArtifacts", config, metrics);
  logger.info("Fetched runtime artifacts", { count: runtimeArtifacts.length });
  const runtimeById = new Map(runtimeArtifacts.map((rt) => [rt.Id, rt]));

  const iflows = [];
  for (const pkg of packages) {
    const pkgIflows = await fetchPagedOData(
      client,
      `/api/v1/IntegrationPackages('${encodeURIComponent(pkg.Id)}')/IntegrationDesigntimeArtifacts`,
      config,
      metrics
    );
    iflows.push(...pkgIflows);
  }

  logger.info("Fetched iFlow catalog", { count: iflows.length });

  const enriched = [];
  for (const iflow of iflows) {
    try {
      const details = await fetchIflowDetails(client, iflow, serviceEndpoints, runtimeById, config, metrics);
      enriched.push({ ...iflow, ...details });
    } catch (error) {
      metrics.warnings += 1;
      logger.warn("Partial iFlow detail fetch failed", {
        iflowId: iflow.Id,
        version: iflow.Version,
        error: error.message
      });
      enriched.push({
        ...iflow,
        variables: [],
        configurations: [],
        resources: [],
        adapters: [],
        flowProperties: [],
        internalSteps: [],
        securityDetails: { credentialRefs: [], authModes: [], userRoles: [], secureParameterKeys: [] },
        dependencies: [],
        errorHandling: { hasErrorFlow: false, retryArtifacts: [] },
        runtime: null
      });
    }
  }

  return enriched;
}

module.exports = {
  fetchAllIflows
};
