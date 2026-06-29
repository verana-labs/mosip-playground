import { NextRequest, NextResponse } from "next/server";
import { ESIGNET_AUTHORIZE, SCOPE, ACR, CALLBACK_PATH, publicOrigin } from "../../../lib/issue-server";

export const dynamic = "force-dynamic";

// Kicks off the eSignet authorization-code flow: 302 to the real eSignet login.
// A random state is stored in an httpOnly cookie and checked back in the callback.
export async function GET(req: NextRequest) {
  const clientId = process.env.PLAYGROUND_OIDC_CLIENT_ID || "mosip-playground";
  const redirectUri = `${publicOrigin(req.nextUrl.origin)}${CALLBACK_PATH}`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPE,
    redirect_uri: redirectUri,
    state,
    acr_values: ACR,
    display: "page",
    prompt: "consent",
    ui_locales: "en",
  });

  const res = NextResponse.redirect(`${ESIGNET_AUTHORIZE}?${params.toString()}`);
  res.cookies.set("issue_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    maxAge: 600,
    path: "/",
  });
  return res;
}
