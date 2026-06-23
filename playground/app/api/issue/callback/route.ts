import { NextRequest, NextResponse } from "next/server";
import {
  ESIGNET_TOKEN,
  CERTIFY_CREDENTIAL,
  CALLBACK_PATH,
  CREDENTIAL_DEFINITION,
  clientAssertion,
  proofJwt,
  putIssued,
} from "../../../lib/issue-server";

export const dynamic = "force-dynamic";

function back(origin: string, params: Record<string, string>) {
  const u = new URL("/", origin);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.hash = "issue";
  const res = NextResponse.redirect(u);
  res.cookies.delete("issue_state");
  return res;
}

// eSignet redirects here with ?code&state. Exchange the code for a token using a
// private_key_jwt assertion, then call Certify's credential endpoint with an
// OID4VCI proof, and hand the signed VC back to the page through a one-time store.
// Upstream error detail is logged server-side only; the client gets an opaque code.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const sp = req.nextUrl.searchParams;

  if (sp.get("error")) return back(origin, { issue_error: "login_failed" });

  const code = sp.get("code");
  const state = sp.get("state");
  const cookieState = req.cookies.get("issue_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return back(origin, { issue_error: "state_mismatch" });
  }

  try {
    const redirectUri = `${origin}${CALLBACK_PATH}`;

    const assertion = await clientAssertion(ESIGNET_TOKEN);
    const tokenRes = await fetch(ESIGNET_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.PLAYGROUND_OIDC_CLIENT_ID || "mosip-playground",
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: assertion,
      }),
    });
    if (!tokenRes.ok) {
      console.error(`[issue] token ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 500)}`);
      return back(origin, { issue_error: `token_${tokenRes.status}` });
    }
    const token = await tokenRes.json();
    const accessToken = token.access_token;
    if (typeof accessToken !== "string" || !accessToken) {
      return back(origin, { issue_error: "token_invalid" });
    }

    const requestCredential = (nonce: string | undefined) =>
      proofJwt(nonce).then((proof) =>
        fetch(CERTIFY_CREDENTIAL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            format: "ldp_vc",
            credential_definition: CREDENTIAL_DEFINITION,
            proof: { proof_type: "jwt", jwt: proof },
          }),
        }),
      );

    let credRes = await requestCredential(token.c_nonce as string | undefined);
    if (credRes.status === 400) {
      // Certify may reject the first proof and return a fresh c_nonce; retry once.
      const body = (await credRes.clone().json().catch(() => ({}))) as { c_nonce?: string };
      if (body.c_nonce) credRes = await requestCredential(body.c_nonce);
    }
    if (!credRes.ok) {
      console.error(`[issue] credential ${credRes.status}: ${(await credRes.text()).slice(0, 500)}`);
      return back(origin, { issue_error: `credential_${credRes.status}` });
    }

    const cred = await credRes.json();
    return back(origin, { issued: putIssued(cred.credential ?? cred) });
  } catch (e) {
    console.error("[issue] callback error:", e);
    return back(origin, { issue_error: "issue_failed" });
  }
}
