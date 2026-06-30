"use client";

import { useEffect, useState } from "react";
import { Loader2, Braces } from "lucide-react";
import { INDEXER, ECOSYSTEM } from "../config";

type Field = { name: string; type: string; note: string };

function fieldsOf(schema: Record<string, unknown>): Field[] {
  const subject =
    ((schema?.properties as Record<string, { properties?: Record<string, Record<string, unknown>> }>)
      ?.credentialSubject?.properties) ?? {};
  return Object.entries(subject).map(([name, def]) => {
    const d = (def ?? {}) as Record<string, unknown>;
    const enumVals = Array.isArray(d.enum) ? ` (${(d.enum as string[]).join(", ")})` : "";
    const fmt = d.format ? `, ${d.format}` : "";
    return { name, type: `${d.type ?? ", "}${fmt}`, note: enumVals };
  });
}

export default function SchemaCard() {
  const [raw, setRaw] = useState<string | null>(null);
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`${INDEXER}/cs/v1/get/${ECOSYSTEM.schemaId}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        const cs = d?.schema ?? d?.credential_schema ?? d;
        const js = cs?.json_schema;
        if (!js) throw new Error("schema not found");
        const parsed = JSON.parse(js);
        setSchema(parsed);
        setRaw(JSON.stringify(parsed, null, 2));
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setError(e instanceof Error ? e.message : "failed to load schema");
      });
    return () => ac.abort();
  }, []);

  const fields = schema ? fieldsOf(schema) : [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2">
          <Braces className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-gray-900 text-sm">{ECOSYSTEM.schema}</span>
          <span className="text-xs text-gray-400">schema #{ECOSYSTEM.schemaId} · Ecosystem {ECOSYSTEM.ecosystemId}</span>
        </div>
        {raw && (
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-violet-600 hover:text-violet-800">
            {open ? "hide JSON" : "show JSON"}
          </button>
        )}
      </div>

      <div className="p-5">
        {error ? (
          <p className="text-sm text-rose-600">Couldn&apos;t load the schema ({error}).</p>
        ) : !schema ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading the on-chain schema…
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              These are the claims a Foundational Resident ID attests. Every credential issued under this
              ecosystem must conform to this schema, and points back to it so a verifier can confirm it.
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {fields.map((f) => (
                <li key={f.name} className="flex items-baseline gap-2">
                  <span className="font-mono text-gray-800">{f.name}</span>
                  <span className="text-xs text-gray-400">
                    {f.type}
                    {f.note}
                  </span>
                </li>
              ))}
            </ul>
            {open && raw && (
              <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-gray-900 text-gray-100 text-xs p-4 leading-relaxed">
                {raw}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
