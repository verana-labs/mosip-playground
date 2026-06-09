import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: [
    "jsonld",
    "jsonld-signatures",
    "@digitalbazaar/vc",
    "@digitalbazaar/ed25519-signature-2020",
    "@digitalbazaar/ed25519-verification-key-2020",
  ],
};

export default nextConfig;
