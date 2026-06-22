"use client";

import {
  Fingerprint,
  ScrollText,
  ShieldCheck,
  BadgeCheck,
  KeyRound,
  ArrowDown,
  ArrowUpRight,
  Coins,
  Ban,
  Boxes,
} from "lucide-react";
import SectionHeading from "./components/SectionHeading";
import ConceptCard from "./components/ConceptCard";
import TrustCard from "./components/TrustCard";
import TrustDiagram from "./components/TrustDiagram";
import PermissionTree from "./components/PermissionTree";
import SchemaCard from "./components/SchemaCard";
import IssueButton from "./components/IssueButton";
import ResolverVerdict from "./components/ResolverVerdict";
import {
  ECOSYSTEM,
  ECOSYSTEM_URL,
  ORG,
  ISSUER,
  VERIFIER,
  INJI_VERIFY_UI,
  INJI_WEB,
  VISUALIZER,
} from "./config";

const phase3 = [
  { icon: BadgeCheck, title: "Delegated accreditation", desc: "A grantor can accredit a second issuer with no transaction from the ecosystem root, and it still resolves as authorized. The tree simply grows another branch." },
  { icon: Coins, title: "Fees & deposits", desc: "Issuance and verification can be metered with on-chain fees and trust deposits, collected automatically through permission sessions." },
  { icon: Ban, title: "Revocation & slashing", desc: "Any permission can be revoked on-chain, and slashing backs the trust guarantees with real, economic accountability." },
  { icon: Boxes, title: "Multiple ecosystems", desc: "A second trust registry can run on the same network, each with its own root, schema and accredited parties, fully isolated." },
];

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="relative bg-gradient-to-b from-violet-50 via-white to-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 pt-14 pb-16 text-center">
          <img src="/mosip-x-verana.png" alt="MOSIP × Verana" className="h-16 mx-auto mb-6" />
          <p className="text-violet-500 text-sm font-semibold tracking-wider uppercase mb-3">
            The trust layer for MOSIP Inji
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            Make every Inji credential prove itself
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
            Your Inji stack already issues a Resident ID and checks its signature. But a signature only proves
            the data wasn&apos;t changed, not that the issuer is a real, accredited authority, or that the
            verifier asking for it is even allowed to. <strong className="text-gray-700">Verana adds that
            missing layer, on-chain.</strong> Follow Asha&apos;s Resident ID through the whole chain and watch
            every party prove itself, live and fail-closed.
          </p>
          <a href="#big-picture" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors">
            See the big picture <ArrowDown className="w-4 h-4" />
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-24">
        {/* 1, the gap */}
        <section id="gap">
          <SectionHeading number={1} title="What a signature can't tell you" subtitle="The gap Verana fills, on top of what Inji already does" />
          <p className="text-gray-600 mb-4 leading-relaxed">
            You already produce signed credentials, and Inji Verify already checks those signatures. That proves
            the data is intact and came from the holder of a given key. It says <strong>nothing</strong> about
            whether the issuer behind that key is a real, accredited authority, or whether the verifier
            requesting Asha&apos;s ID is one she should trust. That gap is where fraud and over-collection live:
            a perfectly valid signature from an issuer nobody vetted, or an over-asking verifier with no right to
            the data.
          </p>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Verana closes it by putting the answer <strong>on-chain</strong>. Every participant, issuer,
            verifier and ecosystem, is a Decentralized Identifier registered in a trust registry, and given an
            explicit permission for one credential type. At any step, anyone can ask the Verana Trust Resolver
            &quot;is this party actually trusted, and authorized for this exact credential?&quot; and get a{" "}
            <strong>fail-closed</strong> answer in one call. These are the four ideas the rest of the story uses.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <ConceptCard icon={Fingerprint} title="Verifiable Credential" description="A tamper-proof claim, here Asha's Foundational Resident ID, issued by MOSIP Inji Certify and signed under a key the issuer controls." color="violet" />
            <ConceptCard icon={KeyRound} title="Decentralized Identifier (DID)" description="A self-owned identifier for each party, the ecosystem, the issuer, the verifier, that the resolver looks up and evaluates against the chain." color="blue" />
            <ConceptCard icon={ScrollText} title="Trust Registry" description="The on-chain record of who may issue or verify what, under one ecosystem. Here: the MOSIP Pilot Authority's registry, #167." color="amber" />
            <ConceptCard icon={ShieldCheck} title="Accreditation (permission)" description="The piece Verana adds: an on-chain permission to act as issuer or verifier for one schema. It can be delegated, metered, and revoked." color="purple" />
          </div>
        </section>

        {/* 2, the big picture (two diagrams) */}
        <section id="big-picture">
          <SectionHeading number={2} title="The whole structure, two ways" subtitle="The flow you tell a room, and the on-chain tree an engineer queries" />
          <p className="text-gray-600 mb-6 leading-relaxed">
            The <strong>MOSIP Pilot Authority</strong> anchors everything. It defines what a Resident ID is, and
            it accredits exactly who may issue and verify it. Asha&apos;s credential chains all the way back to
            that anchor, and Verana lets anyone confirm every link. First the flow, the story in one picture:
          </p>
          <TrustDiagram />
          <p className="text-gray-600 mt-10 mb-6 leading-relaxed">
            That same trust is recorded precisely on-chain as a <strong>permission tree</strong>. This is the
            exact structure a MOSIP engineer would query: each box is a real permission under the schema, with
            its <span className="font-mono text-sm">permissionType</span> and DID, and every edge is one party
            having <em>granted</em> the next a permission. Because our schema requires accreditation
            (ECOSYSTEM mode), the root grants the issuer and verifier <strong>directly</strong>, no intermediary
            grantors. The three services resolve live below:
          </p>
          <PermissionTree />
          <p className="text-gray-500 text-sm mt-6 leading-relaxed">
            Now let&apos;s build that tree up, one move at a time, and after each move the page asks the real
            resolver to prove it. Green means the link holds.
          </p>
        </section>

        {/* 3, move 1: the anchor */}
        <section id="anchor">
          <SectionHeading number={3} title="Move 1, the trust anchor" subtitle="Asha's ID has to chain back to someone you already trust" />
          <p className="text-gray-600 mb-4 leading-relaxed">
            First there is the <strong>{ECOSYSTEM.name}</strong>. It registers on the Verana network, creates a{" "}
            <strong>trust registry</strong> (#{ECOSYSTEM.trustRegistry}), and owns the schema and the governance
            framework. It sits at the root of the permission tree as the <span className="font-mono text-sm">ECOSYSTEM</span>{" "}
            node. Every credential in this ecosystem, including Asha&apos;s, chains back to it.
          </p>
          <p className="text-gray-600 mb-6 leading-relaxed">
            The <strong>real condition</strong>: the anchor doesn&apos;t get to declare itself trusted. It must
            resolve as a <strong>TRUSTED</strong> Verifiable Service, and that holds only because it carries two
            verified credentials from Verana&apos;s own credential service, an Organization credential and a
            Service credential, presented from its DID document. The resolver&apos;s{" "}
            <span className="font-mono text-sm">Q1 (resolve)</span> walks that and returns{" "}
            <span className="font-mono text-sm">trustStatus: TRUSTED</span>. Ask it yourself:
          </p>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm mb-6 grid sm:grid-cols-3 gap-4 text-sm">
            <div><dt className="text-gray-400">Trust registry</dt><dd className="font-semibold text-gray-900">#{ECOSYSTEM.trustRegistry}</dd></div>
            <div><dt className="text-gray-400">Credential schema</dt><dd className="font-semibold text-gray-900">{ECOSYSTEM.schema} (#{ECOSYSTEM.schemaId})</dd></div>
            <div><dt className="text-gray-400">Network</dt><dd className="font-semibold text-gray-900">{ECOSYSTEM.network}</dd></div>
          </div>
          <TrustCard entity={ORG} />
        </section>

        {/* 4, move 2: the schema */}
        <section id="schema">
          <SectionHeading number={4} title="Move 2, the credential schema" subtitle="Define exactly what a Resident ID is, before issuing one" />
          <p className="text-gray-600 mb-4 leading-relaxed">
            Before Asha can be issued anything, the ecosystem publishes <strong>what</strong> a Foundational
            Resident ID is: the exact claims it carries, recorded on-chain as a credential schema. Every
            credential issued here must conform to it, and its <span className="font-mono text-sm">credentialSchema</span>{" "}
            field <strong>points back to it</strong>. That pointer is what lets a verifier, later, confirm two
            things at once: that Asha&apos;s credential is the right <em>kind</em>, and that it was issued under
            the right registry.
          </p>
          <p className="text-gray-600 mb-6 leading-relaxed">
            One detail that matters for the whole demo: this schema is in <strong>ECOSYSTEM permission mode</strong>,
            which means an issuer cannot simply self-register, it must be explicitly accredited by the root.
            (An <span className="font-mono text-sm">OPEN</span> schema would let anyone issue, which is exactly
            the trust gap we are closing.) Here is the live schema, loaded straight from the chain:
          </p>
          <SchemaCard />
        </section>

        {/* 5, move 3: the accredited issuer */}
        <section id="issuer">
          <SectionHeading number={5} title="Move 3, an accredited issuer" subtitle="Running Inji Certify isn't the same as being allowed to issue" />
          <p className="text-gray-600 mb-4 leading-relaxed">
            Now a real <strong>MOSIP Inji Certify</strong> deployment joins as the issuer that will mint
            Asha&apos;s ID, the <span className="font-mono text-sm">ISSUER</span> node in the tree. But running
            Inji Certify is not enough to be believed. A verifier needs two separate things to be true, and the
            resolver checks both in one go:
          </p>
          <ul className="text-gray-600 mb-4 leading-relaxed space-y-3 list-none">
            <li className="flex gap-3">
              <span className="font-mono text-xs mt-1 text-violet-600 shrink-0">Q1</span>
              <span>
                <strong>It is a trusted Verifiable Service.</strong> Inji Certify was made verifiable by adding
                a <strong>service credential</strong> to its DID document, a holder-signed Verifiable
                Presentation that chains back to the anchor. Open the <strong>DID document</strong> on the card
                below to see the added credential and the service identity, this is the &quot;add a service
                credential&quot; step made concrete.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs mt-1 text-violet-600 shrink-0">Q2</span>
              <span>
                <strong>It holds an issuer permission.</strong> The ecosystem granted it an on-chain
                accreditation to act as <em>issuer</em> for this exact schema, the edge from{" "}
                <span className="font-mono text-sm">ECOSYSTEM</span> to <span className="font-mono text-sm">ISSUER</span>{" "}
                in the tree. Without it, even a trusted service resolves as &quot;trusted, but not accredited for
                this credential&quot;, fail closed.
              </span>
            </li>
          </ul>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Green here means both are true at once: <span className="font-mono text-sm">trustStatus: TRUSTED</span>{" "}
            and <span className="font-mono text-sm">authorized: true</span>. That is precisely what
            &quot;accredited issuer&quot; means, and it is the thing a bare signature can never tell you.
          </p>
          <TrustCard entity={ISSUER} />
        </section>

        {/* 6, move 4: issue */}
        <section id="issue">
          <SectionHeading number={6} title="Move 4, issue Asha's credential" subtitle="Now the accredited issuer can do its job" />
          <p className="text-gray-600 mb-6 leading-relaxed">
            With Inji Certify trusted and accredited, it issues Asha a real Foundational Resident ID over
            OID4VCI. The credential is signed, carries her claims (name, date of birth, identifier), and embeds
            the <span className="font-mono text-sm">credentialSchema</span> pointer from Move 2, so any verifier
            can check both the signature <em>and</em> the accreditation behind it. The moment it lands in her
            wallet, Asha becomes the <span className="font-mono text-sm">HOLDER</span> leaf of the tree. Pick a
            resident and issue one:
          </p>
          <IssueButton />
        </section>

        {/* 7, move 5: the verifier */}
        <section id="verifier">
          <SectionHeading number={7} title="Move 5, a verifier Asha can trust back" subtitle="Trust runs both ways" />
          <p className="text-gray-600 mb-4 leading-relaxed">
            A credential is only half the story. When someone asks Asha to present her ID, she should be able to
            ask back: <strong>who are you, and are you even allowed to request this?</strong> So the verifier
            (<strong>Inji Verify</strong>) is checked too. It needs its own <strong>verifier permission</strong>{" "}
            on the schema, the <span className="font-mono text-sm">ECOSYSTEM</span> to{" "}
            <span className="font-mono text-sm">VERIFIER</span> edge in the tree, which the resolver answers as{" "}
            <span className="font-mono text-sm">Q3</span>. An unknown or over-asking verifier resolves as
            untrusted, and the wallet defaults to blocking it before any attribute leaves Asha&apos;s device.
          </p>
          <TrustCard entity={VERIFIER} />
          <div className="mt-6 rounded-xl bg-violet-50 border border-violet-200 p-4">
            <p className="text-sm text-violet-800">
              This is holder protection in action. The hosted{" "}
              <a href={INJI_WEB} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                Inji Web wallet
              </a>{" "}
              runs exactly this check over OpenID4VP before presenting, so trust is confirmed <em>before</em>{" "}
              data is shared, not after.
            </p>
          </div>
        </section>

        {/* 8, real tools */}
        <section id="tools">
          <SectionHeading number={8} title="It's not a mock, it's your tools" subtitle="The same checks, inside official MOSIP Inji" />
          <p className="text-gray-600 mb-6 leading-relaxed">
            Nothing here re-implements Inji. Inji Verify runs the real verification; a thin Verana add-on then
            shows the accreditation verdict on top. Upload one of these sample QRs on the live{" "}
            <a href={INJI_VERIFY_UI} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Inji Verify UI</a>{" "}
            and watch the verdict change with the real conditions:
          </p>
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <a href={INJI_VERIFY_UI} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <img src="/verify-trust-panel.png" alt="Inji Verify showing the Verana Accredited issuer panel" className="w-full" />
            </a>
            <div className="grid grid-cols-2 gap-3">
              {[
                { f: "valid-resident-id", label: "Accredited issuer", tone: "text-emerald-700" },
                { f: "self-signed", label: "Untrusted issuer", tone: "text-rose-700" },
                { f: "wrong-schema", label: "Not accredited here", tone: "text-amber-700" },
                { f: "tampered", label: "Invalid signature", tone: "text-gray-500" },
              ].map((q) => (
                <div key={q.f} className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm">
                  <img src={`/qrs/${q.f}.png`} alt={`${q.label}, sample QR`} className="w-full rounded-md mb-2" />
                  <span className={`text-xs font-medium ${q.tone}`}>{q.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9, bonus explorer */}
        <section id="explore">
          <SectionHeading number={9} title="Check any party yourself" subtitle="The same resolver, on demand, including the counter-example" />
          <p className="text-gray-600 mb-6 leading-relaxed">
            Every card above used this exact query. Here you can drive it: pick a party and the page asks the
            live <strong>Verana Trust Resolver</strong> in your browser, including a self-signed issuer that
            should fail. A valid signature is authenticity; this is legitimacy.
          </p>
          <ResolverVerdict />
        </section>

        {/* 10, governance */}
        <section id="governance">
          <SectionHeading number={10} title="Governance & economics, at scale" subtitle="What keeps the network honest as it grows" />
          <p className="text-gray-600 mb-6 leading-relaxed">
            The permission tree is not just a diagram, it is enforced and economically backed. Accreditation can
            be delegated through grantor branches, metered with fees and deposits, and revoked, with slashing
            behind the guarantees. You can watch the whole ecosystem on the{" "}
            <a href={VISUALIZER} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Verana network visualizer</a>{" "}
            or open it in the{" "}
            <a href={ECOSYSTEM_URL} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">trust registry explorer</a>.
          </p>
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

        {/* 11, recap */}
        <section id="recap">
          <SectionHeading number={11} title="The whole point" subtitle="Authenticity is not legitimacy" />
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm">
            <p className="text-gray-600 leading-relaxed mb-4">
              We followed Asha&apos;s credential from nothing: an anchor that&apos;s trusted, a schema everyone
              agrees on, an issuer that earned the right to issue, the credential itself, and a verifier she can
              trust back. Every box in the permission tree resolved green, live, on-chain. At each step the
              chain answered whether the other party is actually trusted and authorized, and answered{" "}
              <strong>fail-closed</strong>. Official MOSIP Inji components, a thin Verana trust layer on top, no
              forks.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <a href={ECOSYSTEM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-violet-600 hover:underline">This ecosystem in Verana <ArrowUpRight className="w-3.5 h-3.5" /></a>
              <a href={VISUALIZER} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-violet-600 hover:underline">Network visualizer <ArrowUpRight className="w-3.5 h-3.5" /></a>
              <a href={INJI_VERIFY_UI} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-violet-600 hover:underline">Inji Verify <ArrowUpRight className="w-3.5 h-3.5" /></a>
              <a href="https://docs.verana.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-violet-600 hover:underline">Verana docs <ArrowUpRight className="w-3.5 h-3.5" /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        <p>MOSIP × Verana, the Inji trust layer · pilot on {ECOSYSTEM.network}</p>
      </footer>
    </div>
  );
}
