import type { ClientCrmIntegration, CrmIntegrationProvider } from "@/types";

export const CRM_PROVIDERS: CrmIntegrationProvider[] = ["nexa", "webhook", "hubspot", "pipedrive", "rdstation"];

export const EMPTY_CLIENT_CRM_INTEGRATION: ClientCrmIntegration = {
  enabled: false,
  provider: "nexa",
  ingestSecret: "",
  allowedOrigins: [],
  webhookUrl: "",
  hubspotAccessToken: "",
  hubspotPipelineId: "",
  hubspotDealStageId: "",
  pipedriveApiToken: "",
  pipedrivePipelineId: "",
  pipedriveStageId: "",
  rdStationToken: "",
  rdStationConversionIdentifier: "",
  mirrorToInternalCrm: true,
};

export function generateIngestSecret(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `nexa_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `nexa_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function parseClientCrmIntegration(raw: unknown): ClientCrmIntegration {
  if (!raw || typeof raw !== "object") return { ...EMPTY_CLIENT_CRM_INTEGRATION };
  const o = raw as Record<string, unknown>;
  const providerRaw = String(o.provider ?? "nexa").trim().toLowerCase();
  const provider = (CRM_PROVIDERS.includes(providerRaw as CrmIntegrationProvider)
    ? providerRaw
    : "nexa") as CrmIntegrationProvider;

  let allowedOrigins: string[] = [];
  if (Array.isArray(o.allowedOrigins)) {
    allowedOrigins = o.allowedOrigins.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof o.allowedOrigins === "string" && o.allowedOrigins.trim()) {
    allowedOrigins = o.allowedOrigins
      .split(/[\n,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return {
    enabled: o.enabled === true,
    provider,
    ingestSecret: o.ingestSecret != null ? String(o.ingestSecret) : "",
    allowedOrigins,
    webhookUrl: o.webhookUrl != null ? String(o.webhookUrl) : "",
    hubspotAccessToken: o.hubspotAccessToken != null ? String(o.hubspotAccessToken) : "",
    hubspotPipelineId: o.hubspotPipelineId != null ? String(o.hubspotPipelineId) : "",
    hubspotDealStageId: o.hubspotDealStageId != null ? String(o.hubspotDealStageId) : "",
    pipedriveApiToken: o.pipedriveApiToken != null ? String(o.pipedriveApiToken) : "",
    pipedrivePipelineId: o.pipedrivePipelineId != null ? String(o.pipedrivePipelineId) : "",
    pipedriveStageId: o.pipedriveStageId != null ? String(o.pipedriveStageId) : "",
    rdStationToken: o.rdStationToken != null ? String(o.rdStationToken) : "",
    rdStationConversionIdentifier:
      o.rdStationConversionIdentifier != null ? String(o.rdStationConversionIdentifier) : "",
    mirrorToInternalCrm: provider === "nexa" ? true : o.mirrorToInternalCrm === true,
  };
}

export function clientCrmIntegrationToDb(integration: ClientCrmIntegration): Record<string, unknown> {
  return {
    enabled: integration.enabled,
    provider: integration.provider,
    ingestSecret: integration.ingestSecret.trim(),
    allowedOrigins: integration.allowedOrigins.map((o) => o.trim()).filter(Boolean),
    webhookUrl: integration.webhookUrl.trim(),
    hubspotAccessToken: integration.hubspotAccessToken.trim(),
    hubspotPipelineId: integration.hubspotPipelineId.trim(),
    hubspotDealStageId: integration.hubspotDealStageId.trim(),
    pipedriveApiToken: integration.pipedriveApiToken.trim(),
    pipedrivePipelineId: integration.pipedrivePipelineId.trim(),
    pipedriveStageId: integration.pipedriveStageId.trim(),
    rdStationToken: integration.rdStationToken.trim(),
    rdStationConversionIdentifier: integration.rdStationConversionIdentifier.trim(),
    mirrorToInternalCrm: integration.provider === "nexa" ? true : integration.mirrorToInternalCrm,
  };
}

export function originsToText(origins: string[]): string {
  return origins.join("\n");
}

export function textToOrigins(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildCrmFormSnippet(opts: {
  endpoint: string;
  clientSlug: string;
  ingestSecret: string;
}): string {
  const { endpoint, clientSlug, ingestSecret } = opts;
  return `<!-- Nexa CRM — Webflow: Project Settings → Custom Code → Footer -->
<script>
(function () {
  var NEXA_CRM = {
    endpoint: ${JSON.stringify(endpoint)},
    clientSlug: ${JSON.stringify(clientSlug)},
    ingestSecret: ${JSON.stringify(ingestSecret)},
  };

  function pickField(fd, form, keys, dataNames) {
    for (var i = 0; i < keys.length; i++) {
      var v = fd.get(keys[i]);
      if (v != null && String(v).trim()) return String(v).trim();
    }
    if (form && dataNames) {
      for (var j = 0; j < dataNames.length; j++) {
        var el = form.querySelector('[data-name="' + dataNames[j] + '"]');
        if (el && "value" in el && String(el.value).trim()) return String(el.value).trim();
      }
    }
    return "";
  }

  function payloadFromForm(form) {
    var fd = new FormData(form);
    var assunto = pickField(fd, form, ["Assunto", "assunto"], null);
    var area = pickField(fd, form, ["rea", "Area", "Área", "area"], ["Área"]);
    var moradores = pickField(fd, form, ["Moradores", "moradores"], null);
    var userMessage = pickField(fd, form, ["message", "Message", "mensagem", "Mensagem", "Message-2", "field"], null);
    var metaLines = [];
    if (assunto) metaLines.push("Assunto: " + assunto);
    if (area) metaLines.push("Área: " + area);
    if (moradores) metaLines.push("Moradores: " + moradores);
    var message = userMessage;
    if (metaLines.length) {
      message = metaLines.join("\\n") + (userMessage ? "\\n\\n" + userMessage : "");
    }
    var custom = {};
    if (assunto) custom.assunto = assunto;
    if (area) custom.area = area;
    if (moradores) custom.moradores = moradores;
    return {
      name: pickField(fd, form, ["name", "Name", "nome", "Nome", "full-name", "Full-Name"], null),
      email: pickField(fd, form, ["email", "Email", "e-mail", "E-mail"], null),
      phone: pickField(fd, form, ["phone", "Phone", "telefone", "Telefone", "tel"], null),
      company: pickField(fd, form, ["company", "Company", "empresa", "Empresa"], null),
      message: message,
      source: "Website",
      website: pickField(fd, form, ["website", "Website"], null) || "",
      custom: custom,
    };
  }

  function showStatus(form, text) {
    var el = form.querySelector("[data-nexa-status]") || document.getElementById("nexa-lead-status");
    if (!el) {
      el = document.createElement("p");
      el.setAttribute("data-nexa-status", "1");
      el.style.marginTop = "8px";
      form.appendChild(el);
    }
    el.style.display = "block";
    el.textContent = text;
  }

  function submitToNexa(form, payload) {
    if (!payload.name || !payload.email) {
      showStatus(form, "Preencha nome e e-mail.");
      return;
    }
    if (payload.website) return;
    showStatus(form, "Enviando…");
    fetch(NEXA_CRM.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Slug": NEXA_CRM.clientSlug,
        "X-Ingest-Secret": NEXA_CRM.ingestSecret,
      },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        showStatus(form, res.ok ? "Enviado com sucesso!" : (res.j && res.j.error) || "Erro ao enviar.");
        if (res.ok) form.reset();
      })
      .catch(function () { showStatus(form, "Erro de rede. Tente novamente."); });
  }

  function bindForm(form) {
    if (form.getAttribute("data-nexa-bound") === "1") return;
    form.setAttribute("data-nexa-bound", "1");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      e.stopPropagation();
      submitToNexa(form, payloadFromForm(form));
    }, true);
  }

  function shouldBindForm(form) {
    if (!form || form.id === "nexa-lead-form") return false;
    if (form.getAttribute("data-nexa-ignore") === "1") return false;
    return true;
  }

  function init() {
    var selectors = [
      ".w-form form",
      "form.w-form",
      "form[data-wf-page-id]",
      'form[id^="wf-form-"]',
      "form[data-nexa-crm]",
    ];
    var seen = new Set();
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (form) {
        if (!shouldBindForm(form) || seen.has(form)) return;
        seen.add(form);
        bindForm(form);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
</script>
<!-- Honeypot only (not a w-form — avoids stealing Webflow form bindings) -->
<div id="nexa-lead-honeypot" style="display:none" aria-hidden="true">
  <input name="website" tabindex="-1" autocomplete="off" />
</div>`;
}
