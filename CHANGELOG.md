# Changelog

## [1.2.0](https://github.com/verana-labs/mosip-playground/compare/v1.1.0...v1.2.0) (2026-06-15)


### Features

* [mosip] hosted showcase playground (phases 0-3 + live trust widget) ([#12](https://github.com/verana-labs/mosip-playground/issues/12)) ([a60a8aa](https://github.com/verana-labs/mosip-playground/commit/a60a8aa227dc4359ef1ef52c610148379805c8cc))
* [mosip] phase 2 — certify auth-code via our eSignet + UIN-keyed CSV ([e6cdbf3](https://github.com/verana-labs/mosip-playground/commit/e6cdbf336347812c3b8e5d06d69387ab8868643e))
* [mosip] phase 2 — standalone eSignet authorization server ([1959dc4](https://github.com/verana-labs/mosip-playground/commit/1959dc41e217b3c1b6c48868fc736e9370645c3b))
* [mosip] phase 2 holder gate (verana-vp-gate) + co-brand certify credential logo (fixes wallet download) ([955e33d](https://github.com/verana-labs/mosip-playground/commit/955e33dc5f1766e46fe027497658834470b6d16b))
* [mosip] phase 2a — register inji-verify as Verana VERIFIER (did:web + ECS linked-VP) ([50dcc0b](https://github.com/verana-labs/mosip-playground/commit/50dcc0b440b53e1126ae1fc76eebf35e8e4f8947))
* [mosip] register resident_id_vc_ldp credential scope on esignet-vs (unblocks wallet download) ([c375366](https://github.com/verana-labs/mosip-playground/commit/c37536672c15dd75c27f1995d68e6ded2fed4087))


### Bug Fixes

* [mosip] certify authn issuer-uri drop /v1/esignet (token iss is bare esignet domain) so credential download stops 401 invalid_token ([bd1f87b](https://github.com/verana-labs/mosip-playground/commit/bd1f87b9bd858997f0bb80e6e0021abad1ad68f4))
* [mosip] certify display-logo deploy (DB inji_certify, wait-for-table, Recreate restart) ([34e990d](https://github.com/verana-labs/mosip-playground/commit/34e990d3c7a698319848345cc4a6f32b87c5de5e))
* [mosip] ephemeral eSignet postgres so keymanager keystore+DB stay in sync ([7fa4dd1](https://github.com/verana-labs/mosip-playground/commit/7fa4dd1117595fd2c6c7bbaa0acefce5c2c8a1c1))
* [mosip] eSignet as faithful minimal port of MOSIP compose (drop over-config) ([86e4872](https://github.com/verana-labs/mosip-playground/commit/86e487207dfea6dce324dce2676eec86560071cf))
* [mosip] esignet deploy resets full stack (keystore-DB lifecycle) + re-registers wallet-demo + VC-scope smoke test ([654cf49](https://github.com/verana-labs/mosip-playground/commit/654cf49cd2fd8d0cd51956a8e2f3205bcedea188))
* [mosip] eSignet loads bundled config via env overrides, not SPRING_CONFIG_LOCATION ([bb34a6c](https://github.com/verana-labs/mosip-playground/commit/bb34a6c0c937fea6197ae725acb81fa7326056b3))
* [mosip] restore mock-identity ESIGNET_ISSUER_ID + memory headroom ([b4f3f6e](https://github.com/verana-labs/mosip-playground/commit/b4f3f6ed4f019bd4c3f9dbb39dd1f222f45f1293))
* [mosip] run oidc-ui + mock-identity as root + Recreate strategy (match compose) ([b950c63](https://github.com/verana-labs/mosip-playground/commit/b950c63068b02840f78d6b2c99223eaab053da42))
* [mosip] schema-valid numeric mock UINs (esignet identities + certify CSV), fail identity load on errors ([e76c5ac](https://github.com/verana-labs/mosip-playground/commit/e76c5acee0994ef2d00435fa933a4f4eb8789197))
* [mosip] verana-vp-gate hooks XHR (inji-web uses axios) so the present flow is actually gated; fix render loop + placement ([08a93f9](https://github.com/verana-labs/mosip-playground/commit/08a93f9bfaac5fb1ab3053b1544e0e28a6546fdc))
* [mosip] verify-service vp-request kid path (:verify -&gt; :v1:verify) so mimoto resolves the verifier key ([1a0b114](https://github.com/verana-labs/mosip-playground/commit/1a0b114e6c8ca5e4c725d11a4de0be1ebc67fe69))

## [1.1.0](https://github.com/verana-labs/mosip-playground/compare/v1.0.0...v1.1.0) (2026-06-11)


### Features

* [mosip] phase 0 real Inji Certify issuance ([#6](https://github.com/verana-labs/mosip-playground/issues/6)) ([e789c41](https://github.com/verana-labs/mosip-playground/commit/e789c41fc26c9165e30b5ab7794d2da5115f7a60))
* [mosip] phase 1 inji verify trust check ([#5](https://github.com/verana-labs/mosip-playground/issues/5)) ([8ad10e4](https://github.com/verana-labs/mosip-playground/commit/8ad10e40638ad7259c3e67925eacf31af5228413))

## 1.0.0 (2026-06-09)


### Features

* [mosip] phase 0 org + inji issuer trusted on k8s ([#1](https://github.com/verana-labs/mosip-playground/issues/1)) ([6b9c6ad](https://github.com/verana-labs/mosip-playground/commit/6b9c6ad1879658766edac06e693b1b4e1b1ce58a))
