# Verana add-on over the OFFICIAL, unmodified Inji Verify UI image.
# No fork, no source copy — their image is the base; we add one script and a
# <script> tag so the Verana trust panel renders after MOSIP verifies a credential.
FROM injistack/inji-verify-ui:0.18.1

COPY public/verana-trust-panel.js /usr/share/nginx/html/verana-trust-panel.js

# Inject the add-on into the served SPA shell (idempotent: only if not present).
RUN if ! grep -q 'verana-trust-panel.js' /usr/share/nginx/html/index.html; then \
      sed -i 's#</body>#<script src="/verana-trust-panel.js" defer></script></body>#' \
        /usr/share/nginx/html/index.html; \
    fi

# Make the resolver URL configurable through the image's existing env mechanism
# (configure_start.sh reads .env into window._env_; a container env var overrides it).
RUN if ! grep -q 'VERANA_RESOLVER_URL' /usr/share/nginx/html/.env; then \
      echo 'VERANA_RESOLVER_URL=https://resolver.testnet.verana.network' >> /usr/share/nginx/html/.env; \
    fi
