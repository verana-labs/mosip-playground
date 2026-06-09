declare module "@digitalbazaar/ed25519-signature-2020" {
  export class Ed25519Signature2020 {
    constructor(options?: { key?: unknown });
  }
}

declare module "@digitalbazaar/vc" {
  export function verifyCredential(options: {
    credential: Record<string, unknown>;
    suite: unknown;
    documentLoader: (url: string) => Promise<{
      contextUrl: null;
      documentUrl: string;
      document: unknown;
    }>;
    checkStatus?: (options: unknown) => Promise<{ verified: boolean }>;
  }): Promise<{
    verified: boolean;
    error?: { errors?: Error[]; message?: string };
    results?: Array<{ verified: boolean; error?: { message?: string } }>;
  }>;
}
