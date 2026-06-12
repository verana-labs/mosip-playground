# Verana holder gate — add-on over the OFFICIAL, unmodified Inji Web wallet image.
# No fork, no source copy: their image is the base; we add one script and a <script>
# tag. Before any credential data leaves the wallet over OpenID4VP, the gate asks the
# Verana Trust Resolver whether the RELYING PARTY (verifier) is a Trusted Verifiable
# Service (Q1) with an active VERIFIER accreditation for the requested credential type
# (Q3), shows who is asking + the verdict, and DEFAULT-BLOCKS unknown/over-asking
# verifiers. Same additive pattern as the phase-1 inji-verify-ui trust panel.
FROM injistack/inji-web:0.16.0

COPY public/verana-vp-gate.js /usr/share/nginx/html/verana-vp-gate.js
COPY public/cobrand.png /usr/share/nginx/html/cobrand.png

# Inject the gate into the served SPA shell (idempotent). NOT deferred: the fetch hook
# must install before the wallet makes any presentation call. Build FAILS LOUDLY if the
# injection no-ops (e.g. base image changes its index.html) — shipping ungated is worse
# than not shipping.
RUN if ! grep -q 'verana-vp-gate.js' /usr/share/nginx/html/index.html; then \
      sed -i 's#</body>#<script src="/verana-vp-gate.js"></script></body>#' \
        /usr/share/nginx/html/index.html; \
    fi; \
    grep -q 'verana-vp-gate.js' /usr/share/nginx/html/index.html \
      || (echo "FATAL: verana-vp-gate.js was not injected into index.html (base image format changed?)" && exit 1)

# Expose the resolver URL + resident-id VTJSC through the image's existing runtime
# config (env.config.js sets window._env_). A container env var can override at runtime.
RUN if ! grep -q 'VERANA_RESOLVER_URL' /usr/share/nginx/html/env.config.js; then \
      sed -i 's#^}#  VERANA_RESOLVER_URL: "https://resolver.testnet.verana.network",\n  VERANA_VTJSC_ID: "https://organization-vs.mosip.testnet.verana.network/vt/schemas-resident-id-jsc.json",\n}#' \
        /usr/share/nginx/html/env.config.js; \
    fi
