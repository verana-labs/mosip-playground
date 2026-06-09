export type TrustStatus = "TRUSTED" | "PARTIAL" | "UNTRUSTED";

export interface ResolvedCredential {
  id: string;
  type: string;
  claims: Record<string, unknown>;
  format: string;
  result: string;
  ecsType: string;
  issuedBy: string;
  presentedBy: string;
}

export interface TrustResolution {
  did: string;
  trustStatus: TrustStatus;
  production: boolean;
  evaluatedAt: string;
  evaluatedAtBlock: number;
  credentials: ResolvedCredential[];
  dereferenceErrors: unknown[];
  failedCredentials: unknown[];
}

export interface IssuerAuthorization {
  did: string;
  vtjscId: string;
  authorized: boolean;
  evaluatedAt: string;
}

export type ResolverOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; notFound: true }
  | { ok: false; notFound?: false; error: string };

export type Verdict =
  | "INVALID_CREDENTIAL"
  | "TRUSTED_AUTHORIZED"
  | "TRUSTED_NOT_AUTHORIZED"
  | "TRUSTED_NO_SCHEMA"
  | "PARTIAL_TRUST"
  | "UNTRUSTED"
  | "RESOLVER_UNAVAILABLE"
  | "VERIFY_SERVICE_UNAVAILABLE";

export interface IssuerIdentity {
  serviceName?: string;
  serviceDescription?: string;
  organizationName?: string;
  countryCode?: string;
  registryId?: string;
  address?: string;
  ecosystemDid?: string;
}

export interface TrustReport {
  verdict: Verdict;
  // MOSIP Inji Verify (real verify-service) results
  signatureValid: boolean;
  signatureError?: string;
  expiryValid?: boolean;
  claims?: Record<string, unknown>;
  // extracted from the credential
  issuerDid?: string;
  schemaId?: string;
  // Verana Trust Network results
  trustStatus?: TrustStatus;
  authorized?: boolean;
  identity?: IssuerIdentity;
  evaluatedAt?: string;
  evaluatedAtBlock?: number;
  production?: boolean;
  resolverError?: string;
}
