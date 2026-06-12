// Verana Holder Gate — verify the VERIFIER before presenting (Phase 2).
//
// Additive add-on injected on top of the official, unmodified Inji Web wallet image
// (injistack/inji-web). It changes nothing in MOSIP's OpenID4VP flow: it hooks the
// wallet's HTTP layer — BOTH window.fetch AND XMLHttpRequest, because Inji Web drives
// the present flow over axios (XHR), so a fetch-only gate would never fire — and when a
// relying party requests a presentation it asks the Verana Trust Resolver "is this
// verifier a Trusted Verifiable Service (Q1) with an active VERIFIER accreditation for
// this credential (Q3)?" — shows the verdict on the consent screen and DEFAULT-BLOCKS
// the share before any vp_token can leave the wallet.
//
// Hard gate: PATCH /wallets/*/presentations/{id} (which assembles + dispatches the
// vp_token) is intercepted on both transports and refused unless the verdict for THAT
// presentation is TRUSTED_AUTHORIZED. Security posture (hardened after audit):
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

  // --- Transport-agnostic predicates + handlers (shared by the fetch and XHR hooks) ---
  // Inji Web drives the present flow over axios (XMLHttpRequest), NOT fetch, so BOTH
  // transports must be hooked — a fetch-only gate is a no-op on the real wallet and the
  // vp_token leaves ungated. The two endpoints (confirmed against mimoto):
  //   POST  /wallets/{id}/presentations        -> returns the mimoto-validated verifier
  //   PATCH /wallets/{id}/presentations/{pid}   -> assembles + dispatches the vp_token
  function isPostPresentations(method, path) {
    return method === "POST" && /\/wallets\/[^/]+\/presentations$/i.test(path);
  }
  function isPatchPresentation(method, path) {
    return method === "PATCH" && /\/wallets\/[^/]+\/presentations\/[^/]+$/i.test(path);
  }
  function captureVerifier(d) {
    if (d && d.verifier) startGate(d.verifier, d.presentationId || d.presentation_id);
  }
  // Resolve the gate decision for a dispatch path. Fails CLOSED: an unknown presentation,
  // a pid mismatch, or an unresolved/non-authorized verdict all deny.
  function decideDispatch(path) {
    var pid = path.split("/").pop();
    var g = gates[pid];
    var promise = g && g.promise ? g.promise : Promise.resolve(null);
    return promise.then(function (v) {
      return { allowed: !!(g && g.presentationId === pid && isAllowed(v)), verdict: v };
    });
  }

  // --- fetch hook ---
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    var path = pathOf(url);

    if (isPostPresentations(method, path)) {
      return origFetch(input, init).then(function (res) {
        try { res.clone().json().then(captureVerifier).catch(function () {}); } catch (e) {}
        return res;
      });
    }

    if (isPatchPresentation(method, path)) {
      return decideDispatch(path).then(function (d) {
        if (d.allowed) return origFetch(input, init);
        return new Response(
          JSON.stringify({ errors: [{ errorCode: "verana_blocked", errorMessage: blockMsg(d.verdict) }] }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      });
    }

    return origFetch(input, init);
  };

  // --- XMLHttpRequest hook (axios) — same capture + hard-block, fail-closed ---
  var origXhrOpen = XMLHttpRequest.prototype.open;
  var origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__veranaMethod = String(method || "GET").toUpperCase();
    this.__veranaPath = pathOf(url);
    return origXhrOpen.apply(this, arguments);
  };

  // Synthesize a 403 on the instance WITHOUT sending — read-only XHR fields are shadowed
  // by own getters, then the standard completion events are fired so axios rejects cleanly.
  function blockXhr(xhr, verdict) {
    var payload = JSON.stringify({ errors: [{ errorCode: "verana_blocked", errorMessage: blockMsg(verdict) }] });
    function def(name, val) { try { Object.defineProperty(xhr, name, { configurable: true, get: function () { return val; } }); } catch (e) {} }
    def("readyState", 4);
    def("status", 403);
    def("statusText", "Forbidden");
    def("responseText", payload);
    def("response", payload);
    def("responseURL", "");
    // dispatchEvent invokes the on* property handlers too, so we do NOT also call
    // xhr.onreadystatechange manually — that would double-fire and is axios-version-fragile.
    xhr.dispatchEvent(new Event("readystatechange"));
    xhr.dispatchEvent(new Event("load"));
    xhr.dispatchEvent(new Event("loadend"));
  }

  XMLHttpRequest.prototype.send = function () {
    var xhr = this, method = xhr.__veranaMethod, path = xhr.__veranaPath || "";

    if (isPostPresentations(method, path)) {
      xhr.addEventListener("load", function () {
        try { captureVerifier(JSON.parse(xhr.responseText)); } catch (e) {}
      });
      return origXhrSend.apply(xhr, arguments);
    }

    if (isPatchPresentation(method, path)) {
      var args = arguments;
      // Defer the real send until the verdict resolves (mirrors the fetch path); only a
      // confirmed TRUSTED_AUTHORIZED gate for THIS presentation lets the vp_token leave.
      // The .catch guarantees the deny path always terminates the XHR (a synthetic 403)
      // even if anything above throws — the real send already returned, so failing here
      // must never leave the request stranded/hung. Still fail-closed: never sends.
      decideDispatch(path).then(function (d) {
        if (d.allowed) origXhrSend.apply(xhr, args);
        else blockXhr(xhr, d.verdict);
      }).catch(function (e) {
        blockXhr(xhr, { v: "RESOLVER_UNAVAILABLE", err: String(e) });
      });
      return;
    }

    return origXhrSend.apply(xhr, arguments);
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

  // A stable signature for the currently rendered panel — lets tryRender() skip a
  // redundant re-render. Without this, re-rendering mutates the DOM, which re-fires the
  // MutationObserver below, which calls tryRender again -> infinite loop that hangs the tab.
  function renderKey(g) { return (g.presentationId || "") + "|" + ((g.verdict && g.verdict.v) || ""); }

  // key is applied via setAttribute by the caller (NOT interpolated here) — esc() is text-safe
  // only, never attribute-safe, and the panel's XSS invariant forbids dynamic attribute sinks.
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

  // Inji Web renders BOTH a desktop and a mobile (sm:hidden) consent button — toggle every
  // matching button so the share is disabled regardless of which one is visible.
  function gateButton(allowed, report) {
    var btns = document.querySelectorAll('[data-testid="btn-consent-share"]');
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
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
  }

  var observer; // declared up-front so tryRender can pause it across its own mutations

  function tryRender() {
    if (!activeGate || !activeGate.verdict) return;
    var card = document.querySelector('[data-testid="card-credential-request-modal"]');
    var modal = card || document.querySelector('[data-testid="ModalWrapper-Outer-Container"]');
    if (!modal) return;
    var existing = document.getElementById("verana-vp-gate");
    var key = renderKey(activeGate);
    // Already showing this exact verdict for this presentation -> only (idempotently)
    // re-assert the button state and bail. Prevents the observer feedback loop.
    if (existing && existing.getAttribute("data-verana-key") === key) {
      gateButton(isAllowed(activeGate.verdict), activeGate.verdict);
      return;
    }
    var html = panelHtml(activeGate.verdict, activeGate.verifier);
    // Pause observation while WE mutate, so our own DOM writes don't re-trigger tryRender.
    if (observer) observer.disconnect();
    try {
      if (existing) {
        existing.outerHTML = html;
      } else {
        var holder = document.createElement("div");
        holder.innerHTML = html;
        var node = holder.firstChild;
        // Render into the visible modal body. Anchoring next to btn-consent-share fails:
        // the first match is the sm:hidden MOBILE button, so the panel ends up invisible.
        var host = card || modal;
        host.insertBefore(node, host.firstChild);
      }
      // Set the idempotency key via setAttribute (never string-interpolated) so a
      // presentationId containing a quote can't break out of the attribute context.
      var panel = document.getElementById("verana-vp-gate");
      if (panel) panel.setAttribute("data-verana-key", key);
      gateButton(isAllowed(activeGate.verdict), activeGate.verdict);
    } finally {
      if (observer) observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  // --- Re-render whenever the consent modal (re)appears in the DOM --------------
  observer = new MutationObserver(function () { tryRender(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
