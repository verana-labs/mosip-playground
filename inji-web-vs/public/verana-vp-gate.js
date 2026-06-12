// Verana Holder Gate — verify the VERIFIER before presenting (Phase 2).
//
// Additive add-on injected on top of the official, unmodified Inji Web wallet image
// (injistack/inji-web). It changes nothing in MOSIP's OpenID4VP flow: it hooks the
// wallet's fetch, and when a relying party requests a presentation it asks the Verana
// Trust Resolver "is this verifier a Trusted Verifiable Service (Q1) with an active
// VERIFIER accreditation for this credential (Q3)?" — shows the verdict on the consent
// screen and DEFAULT-BLOCKS the share before any vp_token can leave the wallet.
//
// Hard gate: PATCH /wallets/*/presentations/{id} (which assembles + dispatches the
// vp_token) is intercepted and refused unless the verdict for THAT presentation is
// TRUSTED_AUTHORIZED. Security posture (hardened after audit):
//   * Gates are keyed by presentationId — verifier A's verdict can never authorize
//     verifier B's dispatch; an unknown/missed presentation fails CLOSED.
//   * URL matching is on a normalized pathname (query/hash/trailing-slash tolerant,
//     case-insensitive); anything presentation-shaped that isn't a confirmed-allowed
//     gate is blocked — no implicit allow.
//   * The resolver origin is pinned to an https *.verana.network host; a poisoned
//     window._env_ override to a foreign origin is rejected (it could flip the verdict).
//     Residual: the resolver response is not itself signed — trust rests on TLS to the
//     Verana resolver; response-signing is future hardening.
//   * XSS invariant: every dynamic value passes esc() (element-TEXT escaping) and is
//     interpolated only into text positions. Never interpolate a dynamic value into an
//     attribute/style/script sink — esc() is not attribute-safe.
(function () {
  "use strict";

  function safeResolver() {
    var def = "https://resolver.testnet.verana.network";
    var v = window._env_ && window._env_.VERANA_RESOLVER_URL;
    if (!v) return def;
    try {
      var u = new URL(v);
      if (u.protocol === "https:" && /(^|\.)verana\.network$/.test(u.hostname)) return u.origin;
    } catch (e) {}
    return def;
  }
  var RESOLVER = safeResolver();
  var VTJSC =
    (window._env_ && window._env_.VERANA_VTJSC_ID) ||
    "https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json";

  var origFetch = window.fetch.bind(window);
  var gates = {};        // presentationId -> { verifier, did, presentationId, verdict, promise }
  var activeGate = null; // latest gate — for the consent panel render only (never for gating)

  // --- Verana Trust Resolver: Q1 resolve + Q3 verifier-authorization (fail-closed) ---
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
        if (!raw || raw.did !== did || ["TRUSTED", "PARTIAL", "UNTRUSTED"].indexOf(raw.trustStatus) < 0)
          throw new Error("invalid resolution");
        return { ok: true, data: raw };
      },
      function (err) { return err && err.status === 404 ? { ok: false, notFound: true } : { ok: false, error: String(err) }; }
    );
  }

  function resolveVerifierAuth(did, vtjscId) {
    return getJson("/v1/trust/verifier-authorization", { did: did, vtjscId: vtjscId }).then(
      function (raw) {
        if (!raw || raw.did !== did || typeof raw.authorized !== "boolean") throw new Error("invalid auth");
        return { ok: true, data: raw };
      },
      function (err) { return err && err.status === 404 ? { ok: false, notFound: true } : { ok: false, error: String(err) }; }
    );
  }

  function str(v) { return typeof v === "string" ? v : undefined; }
  function identity(resolution) {
    var id = {};
    ((resolution && resolution.credentials) || []).forEach(function (c) {
      if (!c || c.result !== "VALID") return;
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

  // --- Verdict. Only TRUSTED_AUTHORIZED is allowed to present; everything else blocks. ---
  function verdict(did, q1, q3) {
    if (!q1.ok) return q1.notFound ? { v: "UNTRUSTED", did: did } : { v: "RESOLVER_UNAVAILABLE", did: did, err: q1.error };
    var r = q1.data, base = { did: did, id: identity(r), block: r.evaluatedAtBlock };
    if (r.trustStatus !== "TRUSTED") return Object.assign(base, { v: "UNTRUSTED" });
    if (!q3) return Object.assign(base, { v: "RESOLVER_UNAVAILABLE" });
    if (!q3.ok) return q3.notFound ? Object.assign(base, { v: "TRUSTED_NOT_AUTHORIZED" }) : Object.assign(base, { v: "RESOLVER_UNAVAILABLE", err: q3.error });
    return Object.assign(base, { v: q3.data.authorized ? "TRUSTED_AUTHORIZED" : "TRUSTED_NOT_AUTHORIZED" });
  }
  function isAllowed(v) { return !!v && v.v === "TRUSTED_AUTHORIZED"; }
  function blockMsg(v) { return (STYLES[v && v.v] || STYLES.RESOLVER_UNAVAILABLE)[2]; }

  // --- Start the trust check as soon as mimoto returns the validated verifier ---
  function startGate(verifier, presentationId) {
    if (!presentationId) return null; // cannot bind a verdict to a presentation -> no gate -> PATCH fails closed
    var did = verifier && verifier.id;
    var g = { verifier: verifier || {}, did: did, presentationId: String(presentationId), verdict: null };
    if (did && did.indexOf("did:") === 0) {
      g.promise = Promise.all([resolveTrust(did), resolveVerifierAuth(did, VTJSC)])
        .then(function (r) { g.verdict = verdict(did, r[0], r[1]); return g.verdict; })
        .catch(function (e) { g.verdict = { v: "RESOLVER_UNAVAILABLE", did: did, err: String(e) }; return g.verdict; });
    } else {
      g.verdict = { v: "UNTRUSTED", did: did || "(no DID)" };
      g.promise = Promise.resolve(g.verdict);
    }
    gates[g.presentationId] = g;
    activeGate = g;
    g.promise.then(tryRender);
    return g;
  }

  function pathOf(url) {
    try { return new URL(url, location.href).pathname.replace(/\/+$/, ""); }
    catch (e) { return String(url).split("?")[0].split("#")[0].replace(/\/+$/, ""); }
  }

  // --- Fetch hook: capture the verifier on POST, hard-block the share on PATCH ---
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    var path = pathOf(url);

    // mimoto returns the resolved+validated verifier here
    if (method === "POST" && /\/wallets\/[^/]+\/presentations$/i.test(path)) {
      return origFetch(input, init).then(function (res) {
        try {
          res.clone().json().then(function (d) {
            if (d && d.verifier) startGate(d.verifier, d.presentationId || d.presentation_id);
          }).catch(function () {});
        } catch (e) {}
        return res;
      });
    }

    // the single chokepoint that assembles + sends the vp_token — gate it by presentationId
    if (method === "PATCH" && /\/wallets\/[^/]+\/presentations\/[^/]+$/i.test(path)) {
      var pid = path.split("/").pop();
      var g = gates[pid];
      var decide = g && g.promise ? g.promise : Promise.resolve({ v: "RESOLVER_UNAVAILABLE" });
      return decide.then(function (v) {
        if (g && g.presentationId === pid && isAllowed(v)) return origFetch(input, init);
        return new Response(
          JSON.stringify({ errors: [{ errorCode: "verana_blocked", errorMessage: blockMsg(v) }] }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      });
    }

    return origFetch(input, init);
  };

  // --- Verdict panel (rendered into the consent modal) -------------------------
  var STYLES = {
    TRUSTED_AUTHORIZED: ["#16a34a", "Authorized verifier", "This relying party is a Trusted Verifiable Service with an active accreditation to request this credential on the Verana Trust Network. Safe to share."],
    TRUSTED_NOT_AUTHORIZED: ["#dc2626", "Verifier not accredited for this credential", "This service is trusted on Verana but is NOT accredited to request this credential type. Sharing is blocked to prevent over-collection."],
    UNTRUSTED: ["#dc2626", "Unknown verifier — blocked", "This relying party is not a trusted participant of the Verana Trust Network. Sharing is blocked to protect your data. A request is not a reason to trust."],
    RESOLVER_UNAVAILABLE: ["#6b7280", "Trust check unavailable — blocked", "The Verana Trust Resolver could not be reached, so this verifier cannot be confirmed. Sharing is blocked (fail-closed)."],
  };

  // esc(): element-TEXT escaping (&<>). Safe ONLY for text positions, not attributes.
  function esc(s) { var d = document.createElement("div"); d.textContent = String(s); return d.innerHTML; }
  function row(label, value) {
    if (!value) return "";
    return '<div style="display:flex;gap:8px;font-size:13px;margin-top:4px"><span style="min-width:110px;color:#6b7280">' +
      esc(label) + '</span><span style="word-break:break-all;color:#1f2937">' + esc(value) + "</span></div>";
  }

  function panelHtml(report, verifier) {
    var s = STYLES[report.v] || STYLES.RESOLVER_UNAVAILABLE;
    var id = report.id || {};
    return (
      '<div id="verana-vp-gate" style="margin:12px 0;font-family:inherit">' +
      '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:6px">Verana Trust Network · verifier check</div>' +
      '<div style="border:1px solid ' + s[0] + '55;background:' + s[0] + '11;border-radius:10px;padding:14px">' +
      '<div style="font-weight:600;color:' + s[0] + '">' + esc(s[1]) + "</div>" +
      '<div style="font-size:13px;color:#374151;margin-top:4px">' + esc(s[2]) + "</div>" +
      (report.err ? '<div style="font-family:monospace;font-size:11px;color:#6b7280;margin-top:4px">' + esc(report.err) + "</div>" : "") +
      '<div style="margin-top:10px;border-top:1px solid #00000010;padding-top:10px">' +
      row("Requested by", id.organizationName || (verifier && verifier.name)) +
      row("Service", id.serviceName) +
      row("Country", id.countryCode) +
      row("Registry ID", id.registryId) +
      row("Verifier DID", report.did) +
      row("Block height", report.block ? String(report.block) : "") +
      "</div></div></div>"
    );
  }

  function gateButton(allowed, report) {
    var btn = document.querySelector('[data-testid="btn-consent-share"]');
    if (!btn) return;
    if (allowed) {
      btn.disabled = false;
      btn.removeAttribute("data-verana-blocked");
      btn.style.removeProperty("opacity");
      btn.style.removeProperty("cursor");
    } else {
      btn.disabled = true;
      btn.setAttribute("data-verana-blocked", report.v);
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
      btn.title = blockMsg(report);
    }
  }

  function tryRender() {
    if (!activeGate || !activeGate.verdict) return;
    var card = document.querySelector('[data-testid="card-credential-request-modal"]');
    var modal = card || document.querySelector('[data-testid="ModalWrapper-Outer-Container"]');
    if (!modal) return;
    var existing = document.getElementById("verana-vp-gate");
    var html = panelHtml(activeGate.verdict, activeGate.verifier);
    if (existing) {
      existing.outerHTML = html;
    } else {
      var holder = document.createElement("div");
      holder.innerHTML = html;
      var node = holder.firstChild;
      var anchor = document.querySelector('[data-testid="btn-consent-share"]');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(node, anchor);
      else (card || modal).appendChild(node);
    }
    gateButton(isAllowed(activeGate.verdict), activeGate.verdict);
  }

  // --- Re-render whenever the consent modal (re)appears in the DOM --------------
  var observer = new MutationObserver(function () { tryRender(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
