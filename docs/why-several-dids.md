# Why several DIDs, not one

A fair question that comes up looking at the pilot (Fabrice asked it): the demo uses **several DIDs**
around a single Foundational Resident ID credential, an ecosystem DID, an issuer DID, a verifier DID.
Why not one?

## Short answer

They are not several DIDs for "the same credential". They are the identities of **different parties
playing different roles**. A DID identifies a *party*, not a credential, and in this trust model each
party is evaluated, permissioned and held accountable on its own. Collapsing them would conflate roles
that the whole point of Verana is to keep distinct.

## The DIDs in the pilot

| Role | DID | What it is |
|---|---|---|
| **Ecosystem / trust anchor** | `did:webvh:QmUNEz…:organization-vs.mosip.testnet.verana.network` | The MOSIP Pilot Authority. Owns the trust registry, the schema and the governance framework. Root of the permission tree. |
| **Issuer** | `did:web:inji-certify-vs.mosip.testnet.verana.network` | Inji Certify. Holds an `ISSUER` permission on the schema, signs the credentials it issues. |
| **Verifier** | `did:web:inji-verify.mosip.testnet.verana.network:v1:verify` | Inji Verify. Holds a `VERIFIER` permission, the party a wallet checks before presenting. |

The holder (Asha) is the credential subject, she does not need a registered service DID to receive and
present a credential.

## Why keep them separate

1. **Different roles, different permissions.** The resolver answers per party: *is this issuer
   accredited for this schema?* (`Q2`), *is this verifier authorized?* (`Q3`). Those are different
   on-chain permissions (`ISSUER` vs `VERIFIER`) granted to different DIDs. One DID cannot cleanly
   carry both without making "who is allowed to do what" ambiguous.
2. **Independent evaluation.** A verifier checking Asha's credential resolves the *issuer's* DID to
   judge accreditation. If issuer and verifier were the same DID, "the verifier vouching for its own
   issuance" would be circular.
3. **Key separation.** The issuer's signing key, the verifier's key and the ecosystem's controller key
   are different keys held by different deployments. Separate DIDs keep that separation explicit and
   limit blast radius if one key is compromised.
4. **Independent revocation.** A permission can be revoked per DID. You can revoke a misbehaving issuer
   without touching the verifier or the ecosystem.
5. **Accountability.** Trust deposits, fees and slashing attach to a party. Separate DIDs mean each
   party is independently accountable.

## Why `did:webvh` for the anchor and `did:web` for the services

- The **ecosystem anchor** uses `did:webvh` (web + verifiable history). As the root of trust, a
  tamper-evident update history is worth the extra weight, and it is what the Verana vs-agent emits.
- The **issuer and verifier** use `did:web`, served from `/.well-known/did.json`. Simpler, and
  sufficient for a service whose accreditation and accountability already live on-chain.

## Should any be merged for the demo?

**No.** Keep them separate. The permission tree (ecosystem → issuer / verifier → holder) is exactly
what the demo is teaching, and it only makes sense if those are distinct, independently accredited
parties. Merging would shorten the diagram at the cost of the idea it exists to convey.
