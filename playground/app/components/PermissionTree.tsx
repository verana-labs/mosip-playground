"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Check, ShieldX, ArrowDown } from "lucide-react";
import { checkTrust, verdictFor, type TrustResult } from "../lib/trust";
import { ORG, ISSUER, VERIFIER, type Entity } from "../config";

function shortDid(did: string) {
  if (did.length <= 46) return did;
  return `${did.slice(0, 26)}…${did.slice(-14)}`;
}

const OK_LABEL: Record<Entity["kind"], string> = {
  anchor: "Trusted",
  issuer: "Accredited",
  verifier: "Authorized",
};

function LiveStatus({ entity }: { entity: Entity }) {
  const [result, setResult] = useState<TrustResult | null>(null);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    checkTrust(entity, ac.signal).then(
      (r) => {
        if (acRef.current === ac) setResult(r);
      },
      () => {
        if (acRef.current === ac) setResult({ error: "resolver unreachable" });
      },
    );
    return () => ac.abort();
  }, [entity]);

  if (!result) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" /> checking on-chain
      </span>
    );
  }
  const v = verdictFor(entity.kind, result);
  if (v.tone === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <Check className="h-3 w-3" /> {OK_LABEL[entity.kind]}, live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
      <ShieldX className="h-3 w-3" /> {v.title}
    </span>
  );
}

function PermBox({
  name,
  permType,
  did,
  header,
  live,
}: {
  name: string;
  permType: string;
  did: string;
  header: string;
  live?: Entity;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
      <div className={`px-4 py-2 text-center text-sm font-semibold text-white ${header}`}>{name}</div>
      <div className="space-y-0.5 px-4 py-2.5 text-xs text-gray-600">
        <div>
          permissionType: <span className="font-semibold text-gray-800">{permType}</span>
        </div>
        <div className="break-all font-mono text-[11px] text-gray-400">{shortDid(did)}</div>
        {live && <div className="pt-1.5">{<LiveStatus entity={live} />}</div>}
      </div>
    </div>
  );
}

function Grant() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-gray-400">
      <ArrowDown className="h-3 w-3" /> granted schema permission
    </div>
  );
}

export default function PermissionTree() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5 sm:p-7">
      <div className="mb-5 inline-block rounded-md bg-gray-800 px-3 py-1 text-xs font-semibold text-white">
        Foundational Resident ID, permission tree
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="mx-auto max-w-sm">
          <PermBox
            name="MOSIP Pilot Authority"
            permType="ECOSYSTEM (root)"
            did={ORG.did}
            header="bg-teal-500"
            live={ORG}
          />
        </div>

        <Grant />

        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <PermBox name="Inji Certify" permType="ISSUER" did={ISSUER.did} header="bg-violet-500" live={ISSUER} />
            <Grant />
            <PermBox name="Asha" permType="HOLDER" did="the credential subject, holds it in her wallet" header="bg-blue-500" />
          </div>
          <div>
            <PermBox name="Inji Verify" permType="VERIFIER" did={VERIFIER.did} header="bg-pink-500" live={VERIFIER} />
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-gray-400">
        Every box is a real on-chain permission under <span className="font-mono">cs#241</span>. The three
        services resolve live, the green badge is the Verana resolver answering right now.
      </p>
    </div>
  );
}
