"use client";

import {
  Fingerprint,
  ScrollText,
  ShieldCheck,
  BadgeCheck,
  Building2,
  FileCheck2,
  Wallet,
  KeyRound,
  Network,
  ArrowDown,
  ArrowUpRight,
  Coins,
  Ban,
  Boxes,
} from "lucide-react";
import SectionHeading from "./components/SectionHeading";
import ConceptCard from "./components/ConceptCard";
import ResolverVerdict from "./components/ResolverVerdict";
import { ECOSYSTEM, INJI_VERIFY_UI } from "./config";

const components = [
  { name: "MOSIP Pilot Authority", role: "Trust anchor", desc: "Owns the trust registry, the Resident ID schema and the governance framework (EGF).", icon: Building2, color: "text-amber-600 bg-amber-50" },
  { name: "Inji Certify", role: "Issuer · Phase 0", desc: "Issues the Foundational Resident ID as a Verifiable Credential.", icon: FileCheck2, color: "text-violet-600 bg-violet-50" },
  { name: "Inji Verify", role: "Verifier · Phase 1", desc: "Checks the credential, then a Verana add-on shows whether the issuer is accredited.", icon: BadgeCheck, color: "text-emerald-600 bg-emerald-50" },
  { name: "Inji Web wallet", role: "Holder · Phase 2", desc: "Holds the credential and checks the verifier before presenting.", icon: Wallet, color: "text-blue-600 bg-blue-50" },
  { name: "eSignet", role: "Auth server", desc: "OIDC authorization for the wallet's credential download.", icon: KeyRound, color: "text-slate-600 bg-slate-100" },
  { name: "Verana Trust Resolver", role: "Trust layer", desc: "Answers, on-chain: is this party trusted, and authorized for this credential?", icon: Network, color: "text-purple-600 bg-purple-50" },
];

const phase3 = [
  { icon: BadgeCheck, title: "Delegated accreditation", desc: "A grantor accredits a second issuer with no transaction from the ecosystem root — it still resolves as authorized." },
  { icon: Coins, title: "Fees & deposits", desc: "Issuance/verification fees and trust deposits are collected on-chain via permission sessions." },
  { icon: Ban, title: "Revocation", desc: "Permissions can be revoked on-chain, and slashing backs the trust guarantees with real accountability." },
  { icon: Boxes, title: "Multiple ecosystems", desc: "A second trust registry coexists on the same network, each resolving under its own ecosystem." },
];

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="relative bg-gradient-to-b from-violet-50 via-white to-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 pt-14 pb-16 text-center">
          <img src="/mosip-x-verana.png" alt="MOSIP × Verana" className="h-16 mx-auto mb-6" />
          <p className="text-violet-500 text-sm font-semibold tracking-wider uppercase mb-3">
            Inji × Verana trust integration
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            Verifiable trust, end to end
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
            Watch a MOSIP Inji credential get issued, verified and presented, with the Verana Trust
            Network proving who is <em>accredited</em> at every step. A valid signature is authenticity;
            this adds legitimacy.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="#check" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors">
              Check trust live <ArrowDown className="w-4 h-4" />
            </a>
            <a href={INJI_VERIFY_UI} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors">
              Open Inji Verify <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-24">
        {/* 1 — concepts */}
        <section id="concepts">
          <SectionHeading number={1} title="The trust gap" subtitle="Why a valid signature is not enough" />
          <p className="text-gray-600 mb-8 leading-relaxed">
            A signed credential proves it wasn&apos;t tampered with. It does <strong>not</strong> tell you
            whether the issuer is a real, accredited authority, or whether the verifier asking for your data
            is one you should trust. Verana closes that gap.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <ConceptCard icon={Fingerprint} title="Verifiable Credential" description="A tamper-proof digital claim — here, a Foundational Resident ID issued by MOSIP Inji Certify." color="violet" />
            <ConceptCard icon={KeyRound} title="Decentralized Identifier (DID)" description="A self-owned identifier for each party — the issuer, the verifier, the ecosystem — that the resolver evaluates." color="blue" />
            <ConceptCard icon={ScrollText} title="Trust Registry" description="The on-chain record of who may issue or verify what, under an ecosystem. Here: the MOSIP Pilot Authority's registry." color="amber" />
            <ConceptCard icon={ShieldCheck} title="Accreditation" description="An issuer/verifier is accredited for a specific credential type — and it can be delegated, metered, and revoked." color="purple" />
          </div>
        </section>

        {/* 2 — ecosystem */}
        <section id="ecosystem">
          <SectionHeading number={2} title="The MOSIP Pilot Authority ecosystem" subtitle="One trust anchor, the official Inji components, a thin Verana layer" />
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm mb-6 grid sm:grid-cols-3 gap-4 text-sm">
            <div><dt className="text-gray-400">Trust registry</dt><dd className="font-semibold text-gray-900">#{ECOSYSTEM.trustRegistry}</dd></div>
            <div><dt className="text-gray-400">Credential schema</dt><dd className="font-semibold text-gray-900">{ECOSYSTEM.schema} (#{ECOSYSTEM.schemaId})</dd></div>
            <div><dt className="text-gray-400">Network</dt><dd className="font-semibold text-gray-900">{ECOSYSTEM.network}</dd></div>
          </div>
          <div className="space-y-3">
            {components.map((c) => (
              <div key={c.name} className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                  <c.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    <span className="text-xs text-gray-400 font-medium">{c.role}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3 — live verdict widget (centerpiece) */}
        <section id="check">
          <SectionHeading number={3} title="Check trust live" subtitle="Ask the resolver yourself — no curl required" />
          <p className="text-gray-600 mb-6 leading-relaxed">
            Pick a party below. The page queries the live <strong>Verana Trust Resolver</strong> in your
            browser — <span className="font-mono text-sm">resolve</span> (is it trusted?) and{" "}
            <span className="font-mono text-sm">issuer/verifier-authorization</span> (is it accredited for this
            credential?) — and renders the verdict. This is the same check Inji Verify and the wallet make.
          </p>
          <ResolverVerdict />
        </section>

        {/* 4 — phase 0/1 */}
        <section id="issue-verify">
          <SectionHeading number={4} title="Issue & verify a Resident ID" subtitle="Phases 0 and 1 — the credential, and the trust verdict on top" />
          <p className="text-gray-600 mb-6 leading-relaxed">
            Inji Certify issues the Foundational Resident ID; Inji Verify confirms the signature. The Verana
            add-on then adds the verdict that matters: <strong>who issued it, and are they accredited?</strong>
          </p>
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <a href={INJI_VERIFY_UI} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <img src="/verify-trust-panel.png" alt="Inji Verify showing the Verana Accredited issuer panel" className="w-full" />
            </a>
            <div>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Try it on the live <a href={INJI_VERIFY_UI} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Inji Verify UI</a> — upload one of these sample QRs and watch the verdict change:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { f: "valid-resident-id", label: "Accredited issuer", tone: "text-emerald-700" },
                  { f: "self-signed", label: "Untrusted issuer", tone: "text-rose-700" },
                  { f: "wrong-schema", label: "Not accredited here", tone: "text-amber-700" },
                  { f: "tampered", label: "Invalid signature", tone: "text-gray-500" },
                ].map((q) => (
                  <div key={q.f} className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm">
                    <img src={`/qrs/${q.f}.png`} alt={`${q.label} — sample QR`} className="w-full rounded-md mb-2" />
                    <span className={`text-xs font-medium ${q.tone}`}>{q.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5 — phase 2 */}
        <section id="holder">
          <SectionHeading number={5} title="Protect the holder" subtitle="Phase 2 — verify the verifier, before anything is shared" />
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-blue-600 bg-blue-50">
                <Wallet className="w-5 h-5" />
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Before the Inji Web wallet presents a credential over OpenID4VP, it asks Verana whether the{" "}
                <strong>relying party</strong> is a trusted, authorized verifier (the <em>Verifier</em> check in
                the widget above). The wallet shows the holder <strong>who is asking</strong> and{" "}
                <strong>defaults to blocking</strong> unknown or over-asking verifiers — so trust is checked
                before any attribute leaves the device, not after.
              </p>
            </div>
          </div>
        </section>

        {/* 6 — phase 3 */}
        <section id="governance">
          <SectionHeading number={6} title="Governance & economics" subtitle="Phase 3 — a network that scales and stays accountable" />
          <div className="grid sm:grid-cols-2 gap-4">
            {phase3.map((p) => (
              <div key={p.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex gap-4">
                <p.icon className="w-6 h-6 text-violet-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">{p.title}</p>
                  <p className="text-sm text-gray-500">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 7 — recap */}
        <section id="recap">
          <SectionHeading number={7} title="The whole point" subtitle="Authenticity is not legitimacy" />
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm">
            <p className="text-gray-600 leading-relaxed mb-4">
              At every step — issue, verify, present, govern — a participant can ask the chain whether the
              other party is actually trusted and authorized, and gets a <strong>fail-closed</strong> answer.
              Official MOSIP Inji components, a thin Verana trust layer, no forks.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <a href={INJI_VERIFY_UI} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-violet-600 hover:underline">Inji Verify <ArrowUpRight className="w-3.5 h-3.5" /></a>
              <a href="https://docs.verana.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-violet-600 hover:underline">Verana docs <ArrowUpRight className="w-3.5 h-3.5" /></a>
              <a href="https://docs.inji.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-violet-600 hover:underline">MOSIP Inji docs <ArrowUpRight className="w-3.5 h-3.5" /></a>
              <a href="https://github.com/verana-labs/mosip-playground" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-violet-600 hover:underline">Source & phase docs <ArrowUpRight className="w-3.5 h-3.5" /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        <p>MOSIP × Verana — Inji trust integration · pilot on {ECOSYSTEM.network}</p>
      </footer>
    </div>
  );
}
