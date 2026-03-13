function normalizeEndpointKey(type, endpoint) {
  const normalizedType = String(type || "").trim().toUpperCase();
  const normalizedEndpoint = String(endpoint || "").trim().replace(/\/+/g, "/").replace(/\/+$/, "").toLowerCase();
  return normalizedType && normalizedEndpoint ? `${normalizedType}|${normalizedEndpoint}` : "";
}

function buildFlags(integration) {
  const authModes = Array.isArray(integration.securityDetails.authModes)
    ? integration.securityDetails.authModes.map((value) => String(value || "").toLowerCase())
    : [];
  const credentialRefs = Array.isArray(integration.securityDetails.credentialRefs)
    ? integration.securityDetails.credentialRefs.map((value) => String(value || ""))
    : [];

  return {
    hasBasicAuth:
      authModes.some((value) => value.includes("basic")) ||
      credentialRefs.some((value) => /authenticationMethod=Basic/i.test(value)),
    hasSapCloudConnector: credentialRefs.some((value) => /proxyType=sapcc/i.test(value)),
    hasCredentialRefs: credentialRefs.length > 0,
    hasSecureParameters: Array.isArray(integration.securityDetails.secureParameterKeys)
      ? integration.securityDetails.secureParameterKeys.length > 0
      : false
  };
}

function buildAdapterInventory(integrations) {
  return integrations
    .flatMap((integration) =>
      integration.adapters.map((adapter) => ({
        iflowId: integration.id,
        iflowName: integration.name,
        packageName: integration.packageName || integration.packageId,
        direction: adapter.direction || "",
        type: adapter.type || "",
        name: adapter.name || "",
        system: adapter.system || "",
        endpoint: adapter.endpoint || "",
        authMode: adapter.authMode || "",
        credentialRefs: Array.isArray(adapter.credentialRefs) ? adapter.credentialRefs : [],
        riskFlags: [
          integration.flags.hasBasicAuth ? "Basic" : "",
          integration.flags.hasSapCloudConnector ? "sapcc" : "",
          integration.flags.hasCredentialRefs ? "CredentialRef" : "",
          integration.flags.hasSecureParameters ? "SecureParam" : ""
        ].filter(Boolean)
      }))
    )
    .sort((left, right) => {
      if (right.riskFlags.length !== left.riskFlags.length) {
        return right.riskFlags.length - left.riskFlags.length;
      }
      return [left.type, left.endpoint, left.iflowName].join("|").localeCompare([right.type, right.endpoint, right.iflowName].join("|"));
    });
}

function buildInterIflowLinks(integrations) {
  const consumers = integrations.flatMap((integration) =>
    integration.adapters
      .filter((adapter) => /sender/i.test(adapter.direction || "") && adapter.endpoint)
      .map((adapter) => ({ integration, adapter, key: normalizeEndpointKey(adapter.type, adapter.endpoint) }))
  );
  const producers = integrations.flatMap((integration) =>
    integration.adapters
      .filter((adapter) => /receiver/i.test(adapter.direction || "") && adapter.endpoint)
      .map((adapter) => ({ integration, adapter, key: normalizeEndpointKey(adapter.type, adapter.endpoint) }))
  );

  const consumersByKey = new Map();
  for (const consumer of consumers) {
    if (!consumer.key) {
      continue;
    }
    const bucket = consumersByKey.get(consumer.key) || [];
    bucket.push(consumer);
    consumersByKey.set(consumer.key, bucket);
  }

  const links = [];
  for (const producer of producers) {
    if (!producer.key || !consumersByKey.has(producer.key)) {
      continue;
    }

    for (const consumer of consumersByKey.get(producer.key)) {
      if (producer.integration.id === consumer.integration.id) {
        continue;
      }
      links.push({
        from: producer.integration.id,
        fromName: producer.integration.name,
        to: consumer.integration.id,
        toName: consumer.integration.name,
        type: producer.adapter.type,
        endpoint: producer.adapter.endpoint,
        transport: producer.adapter.transport || consumer.adapter.transport || "",
        authMode: producer.adapter.authMode || consumer.adapter.authMode || "",
        relation: producer.adapter.type === "JMS" ? "Queue handoff" : "Direct call"
      });
    }
  }

  return links.sort((left, right) =>
    [left.type, left.endpoint, left.fromName, left.toName].join("|").localeCompare([right.type, right.endpoint, right.fromName, right.toName].join("|"))
  );
}

function classifyConnectionTopology(sourceCount, targetCount) {
  if (sourceCount <= 1 && targetCount <= 1) {
    return "One-to-One";
  }
  if (sourceCount <= 1 && targetCount > 1) {
    return "One-to-Many";
  }
  if (sourceCount > 1 && targetCount <= 1) {
    return "Many-to-One";
  }
  return "Many-to-Many";
}

function buildConnectionHubs(interIflowLinks) {
  const groups = new Map();

  for (const link of interIflowLinks) {
    const key = normalizeEndpointKey(link.type, link.endpoint);
    const group = groups.get(key) || {
      key,
      type: link.type,
      endpoint: link.endpoint,
      relation: link.relation,
      sources: new Set(),
      targets: new Set(),
      links: []
    };

    group.sources.add(link.fromName);
    group.targets.add(link.toName);
    group.links.push(link);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const sources = Array.from(group.sources).sort();
      const targets = Array.from(group.targets).sort();
      return {
        type: group.type,
        endpoint: group.endpoint,
        relation: group.relation,
        sourceCount: sources.length,
        targetCount: targets.length,
        linkCount: group.links.length,
        topology: classifyConnectionTopology(sources.length, targets.length),
        sources,
        targets
      };
    })
    .sort((left, right) => {
      if (right.linkCount !== left.linkCount) {
        return right.linkCount - left.linkCount;
      }
      if (right.sourceCount + right.targetCount !== left.sourceCount + left.targetCount) {
        return right.sourceCount + right.targetCount - (left.sourceCount + left.targetCount);
      }
      return [left.type, left.endpoint].join("|").localeCompare([right.type, right.endpoint].join("|"));
    });
}

function buildCanonicalModel(iflows, metrics) {
  const generatedAt = new Date().toISOString();

  const integrations = iflows.map((iflow) => ({
    id: iflow.Id || "",
    name: iflow.Name || "",
    version: iflow.Version || "",
    packageId: iflow.PackageId || "",
    packageName: iflow.PackageName || "",
    deployedBy: iflow.DeployedBy || "",
    createdAt: iflow.CreationDate || "",
    modifiedAt: iflow.ModificationDate || "",
    adapters: Array.isArray(iflow.adapters) ? iflow.adapters : [],
    variables: Array.isArray(iflow.variables)
      ? iflow.variables.filter((v) => !v.secure)
      : [],
    configurations: Array.isArray(iflow.configurations) ? iflow.configurations : [],
    resources: Array.isArray(iflow.resources) ? iflow.resources : [],
    flowProperties: Array.isArray(iflow.flowProperties) ? iflow.flowProperties : [],
    internalSteps: Array.isArray(iflow.internalSteps) ? iflow.internalSteps : [],
    securityDetails: iflow.securityDetails || {
      credentialRefs: [],
      authModes: [],
      userRoles: [],
      secureParameterKeys: []
    },
    runtime: iflow.runtime || null,
    errorHandling: iflow.errorHandling || { hasErrorFlow: false, retryArtifacts: [] },
    dependencies: Array.isArray(iflow.dependencies) ? iflow.dependencies : []
  }));

  for (const integration of integrations) {
    integration.flags = buildFlags(integration);
  }

  integrations.sort((left, right) => {
    const leftScore = Number(left.flags.hasBasicAuth) + Number(left.flags.hasSapCloudConnector) + Number(left.flags.hasCredentialRefs) + Number(left.flags.hasSecureParameters);
    const rightScore = Number(right.flags.hasBasicAuth) + Number(right.flags.hasSapCloudConnector) + Number(right.flags.hasCredentialRefs) + Number(right.flags.hasSecureParameters);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return left.name.localeCompare(right.name);
  });

  const dependencyEdges = [];
  for (const integration of integrations) {
    for (const dep of integration.dependencies) {
      dependencyEdges.push({
        from: integration.id,
        to: dep.name,
        type: dep.type
      });
    }
  }

  const adapterInventory = buildAdapterInventory(integrations);
  const interIflowLinks = buildInterIflowLinks(integrations);
  const connectionHubs = buildConnectionHubs(interIflowLinks);

  metrics.iflowCount = integrations.length;

  return {
    schemaVersion: "1.0.0",
    generatedAt,
    summary: {
      totalIflows: integrations.length,
      totalDependencies: dependencyEdges.length,
      withErrorFlow: integrations.filter((i) => i.errorHandling.hasErrorFlow).length,
      withCredentialRefs: integrations.filter((i) => (i.securityDetails.credentialRefs || []).length > 0).length,
      withBasicAuth: integrations.filter((i) => i.flags.hasBasicAuth).length,
      withSapCloudConnector: integrations.filter((i) => i.flags.hasSapCloudConnector).length,
      interIflowLinks: interIflowLinks.length,
      oneToManyHubs: connectionHubs.filter((hub) => hub.topology === "One-to-Many").length,
      manyToOneHubs: connectionHubs.filter((hub) => hub.topology === "Many-to-One").length,
      manyToManyHubs: connectionHubs.filter((hub) => hub.topology === "Many-to-Many").length
    },
    integrations,
    adapterInventory,
    interIflowLinks,
    connectionHubs,
    dependencyGraph: dependencyEdges,
    metrics
  };
}

function validateModel(model) {
  const errors = [];
  if (!model || !Array.isArray(model.integrations)) {
    errors.push("Model integrations array missing");
    return errors;
  }

  for (const integration of model.integrations) {
    if (!integration.id) {
      errors.push("Integration without id");
    }
    if (!Array.isArray(integration.adapters)) {
      errors.push(`Integration ${integration.id} has invalid adapters`);
    }
    if (!integration.errorHandling) {
      errors.push(`Integration ${integration.id} has no errorHandling`);
    }
    if (!integration.securityDetails) {
      errors.push(`Integration ${integration.id} has no securityDetails`);
    }
    if (!integration.flags) {
      errors.push(`Integration ${integration.id} has no flags`);
    }
  }

  return errors;
}

module.exports = {
  buildCanonicalModel,
  validateModel
};
