// Verana Trust Network — additive trust panel for MOSIP Inji Verify (Phase 1).
//
// This is an ADD-ON injected on top of the official, unmodified Inji Verify UI
// image (injistack/inji-verify-ui). It does not change MOSIP's verification: it
// hooks the verify-service fetch, and after Inji Verify confirms the signature it
// asks the Verana Trust Resolver "is this issuer accredited?" and renders a panel.
(function () {
  "use strict";

  var RESOLVER =
    (window._env_ && window._env_.VERANA_RESOLVER_URL) ||
    "https://resolver.testnet.verana.network";

  var lastVerification = null; // { credential, success }

  // --- 1. Hook the verify-service call to capture the credential + outcome -----
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    var isVerify = /vc-verification/.test(url) && method === "POST";
    var reqBody = isVerify && init && init.body ? init.body : null;

    var p = origFetch.apply(this, arguments);
    if (!isVerify) return p;

    return p.then(function (res) {
      try {
        res.clone().json().then(function (data) {
          try {
            lastVerification = {
              credential: parseCredential(reqBody),
              success: isSuccess(data),
            };
          } catch (e) {
            lastVerification = null;
          }
        }).catch(function () {});
      } catch (e) {}
      return res;
    });
  };

  function parseCredential(body) {
    if (!body || typeof body !== "string") return null;
    var obj = JSON.parse(body);
    if (Array.isArray(obj)) obj = obj[0];
    if (obj && obj.verifiableCredential) {
      return typeof obj.verifiableCredential === "string"
        ? JSON.parse(obj.verifiableCredential)
        : obj.verifiableCredential;
    }
    return obj; // v1: body is the raw VC
  }

  function isSuccess(data) {
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0 && data.every(function (d) { return d && d.allChecksSuccessful === true; });
    return data.allChecksSuccessful === true || data.verificationStatus === "SUCCESS";
  }

  // --- 2. Extract the two trust inputs from the verified credential ------------
  function extractInputs(vc) {
    if (!vc || typeof vc !== "object") return {};
    var issuer = typeof vc.issuer === "string" ? vc.issuer : vc.issuer && vc.issuer.id;
    var issuerDid = typeof issuer === "string" && issuer.indexOf("did:") === 0 ? issuer : undefined;
    var cs = vc.credentialSchema;
    var refs = Array.isArray(cs) ? cs : cs ? [cs] : [];
    var https = refs.filter(function (r) { return r && typeof r.id === "string" && /^https:\/\//.test(r.id); });
    var pref = https.filter(function (r) { return r.type === "JsonSchemaCredential"; })[0] || https[0];
    return { issuerDid: issuerDid, schemaId: pref ? pref.id : undefined };
  }

  // --- 3. Verana Trust Resolver (Q1 + Q2), fail-closed -----------------------
  function getJson(path, params) {
    var url = new URL(path, RESOLVER);
    Object.keys(params).forEach(function (k) { url.searchParams.set(k, params[k]); });
    return origFetch(url.toString(), { headers: { accept: "application/json" } }).then(function (res) {
      if (res.status === 404) { var e = new Error("not found"); e.status = 404; throw e; }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function resolveTrust(did) {
    return getJson("/v1/trust/resolve", { did: did, detail: "full" }).then(
      function (raw) {
        var ok = ["TRUSTED", "PARTIAL", "UNTRUSTED"].indexOf(raw && raw.trustStatus) >= 0;
        if (!ok || raw.did !== did || !Array.isArray(raw.credentials)) throw new Error("invalid resolution");
        return { ok: true, data: raw };
      },
      function (err) { return err && err.status === 404 ? { ok: false, notFound: true } : { ok: false, error: String(err) }; }
    );
  }

  function resolveAuth(did, vtjscId) {
    return getJson("/v1/trust/issuer-authorization", { did: did, vtjscId: vtjscId }).then(
      function (raw) {
        if (typeof (raw && raw.authorized) !== "boolean" || raw.did !== did || raw.vtjscId !== vtjscId) throw new Error("invalid auth");
        return { ok: true, data: raw };
      },
      function (err) { return err && err.status === 404 ? { ok: false, notFound: true } : { ok: false, error: String(err) }; }
    );
  }

  function identity(resolution) {
    var id = {};
    (resolution.credentials || []).forEach(function (c) {
      if (c.result !== "VALID") return;
      if (c.ecsType === "ECS-SERVICE" && c.id === resolution.did) id.serviceName = str(c.claims && c.claims.name);
      if (c.ecsType === "ECS-ORG") {
        id.organizationName = str(c.claims && c.claims.name);
        id.countryCode = str(c.claims && c.claims.countryCode);
        id.registryId = str(c.claims && c.claims.registryId);
        id.ecosystemDid = str(c.issuedBy);
      }
    });
    return id;
  }
  function str(v) { return typeof v === "string" ? v : undefined; }

  function verdict(issuerDid, schemaId, q1, q2) {
    if (!q1.ok) return q1.notFound ? { v: "UNTRUSTED" } : { v: "RESOLVER_UNAVAILABLE", err: q1.error };
    var r = q1.data, base = { issuerDid: issuerDid, schemaId: schemaId, id: identity(r), block: r.evaluatedAtBlock };
    if (r.trustStatus !== "TRUSTED") return Object.assign(base, { v: r.trustStatus === "PARTIAL" ? "PARTIAL" : "UNTRUSTED" });
    if (!schemaId) return Object.assign(base, { v: "TRUSTED_NO_SCHEMA" });
    if (!q2) return Object.assign(base, { v: "RESOLVER_UNAVAILABLE" });
    if (!q2.ok) return q2.notFound ? Object.assign(base, { v: "TRUSTED_NOT_AUTHORIZED" }) : Object.assign(base, { v: "RESOLVER_UNAVAILABLE", err: q2.error });
    return Object.assign(base, { v: q2.data.authorized ? "TRUSTED_AUTHORIZED" : "TRUSTED_NOT_AUTHORIZED" });
  }

  // --- 4. Render the panel into the Inji Verify result section -----------------
  var STYLES = {
    TRUSTED_AUTHORIZED: ["#16a34a", "Accredited issuer", "The issuer is a Trusted Verifiable Service with an active accreditation to issue this credential type on the Verana Trust Network."],
    TRUSTED_NOT_AUTHORIZED: ["#d97706", "Trusted service — not accredited for this credential", "The issuer is trusted, but it is not accredited to issue this credential type."],
    TRUSTED_NO_SCHEMA: ["#d97706", "Trusted service", "The issuer is trusted, but the credential carries no schema reference to check accreditation."],
    PARTIAL: ["#ca8a04", "Partial trust", "The issuer resolves on Verana but its trust chain is incomplete. Treat with caution."],
    UNTRUSTED: ["#dc2626", "Untrusted issuer", "The signature is valid, but the issuer is not a trusted participant of the Verana Trust Network. A valid signature proves authenticity, not legitimacy."],
    RESOLVER_UNAVAILABLE: ["#6b7280", "Trust resolution unavailable", "The Verana Trust Resolver could not be reached. Do not treat this issuer as accredited."],
  };

  function row(label, value) {
    if (!value) return "";
    return '<div style="display:flex;gap:8px;font-size:13px;margin-top:4px"><span style="min-width:120px;color:#6b7280">' +
      esc(label) + '</span><span style="word-break:break-all;color:#1f2937">' + esc(value) + "</span></div>";
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = String(s); return d.innerHTML; }

  function render(section, report) {
    if (section.querySelector("#verana-trust-panel")) return;
    var s = STYLES[report.v] || STYLES.RESOLVER_UNAVAILABLE;
    var id = report.id || {};
    var el = document.createElement("div");
    el.id = "verana-trust-panel";
    el.style.cssText = "max-width:600px;margin:16px auto;padding:0 16px;font-family:inherit";
    el.innerHTML =
      '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:8px">Verana Trust Network</div>' +
      '<div style="border:1px solid ' + s[0] + '55;background:' + s[0] + '11;border-radius:10px;padding:16px">' +
      '<div style="font-weight:600;color:' + s[0] + '">' + esc(s[1]) + "</div>" +
      '<div style="font-size:13px;color:#374151;margin-top:4px">' + esc(s[2]) + "</div>" +
      (report.err ? '<div style="font-family:monospace;font-size:11px;color:#6b7280;margin-top:4px">' + esc(report.err) + "</div>" : "") +
      (id.organizationName
        ? '<div style="margin-top:12px;border-top:1px solid #00000010;padding-top:12px">' +
          row("Issued by", id.organizationName) + row("Country", id.countryCode) + row("Registry ID", id.registryId) + row("Ecosystem", id.ecosystemDid) +
          "</div>"
        : "") +
      '<div style="margin-top:12px;border-top:1px solid #00000010;padding-top:12px">' +
      row("Issuer DID", report.issuerDid) + row("Schema (VTJSC)", report.schemaId) + row("Block height", report.block ? String(report.block) : "") +
      "</div></div>";
    section.appendChild(el);
  }

  function runFor(section) {
    if (!lastVerification || !lastVerification.success || !lastVerification.credential) return;
    if (section.getAttribute("data-verana") === "done") return;
    section.setAttribute("data-verana", "done");
    var inputs = extractInputs(lastVerification.credential);
    if (!inputs.issuerDid) { render(section, { v: "UNTRUSTED", schemaId: inputs.schemaId }); return; }
    Promise.all([
      resolveTrust(inputs.issuerDid),
      inputs.schemaId ? resolveAuth(inputs.issuerDid, inputs.schemaId) : Promise.resolve(undefined),
    ]).then(function (r) {
      render(section, verdict(inputs.issuerDid, inputs.schemaId, r[0], r[1]));
    });
  }

  // --- 5. Watch for the result screen to appear, then run --------------------
  var observer = new MutationObserver(function () {
    var section = document.getElementById("result-section");
    if (section) runFor(section);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
