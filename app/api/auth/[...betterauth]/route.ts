import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);

const logVerifyEmail = (url: URL, response: Response) => {
  if (!url.pathname.endsWith("/verify-email")) {
    return;
  }

  const setCookie = response.headers.get("set-cookie");
  console.info("[Better Auth] verify-email response", {
    url: url.toString(),
    status: response.status,
    hasSetCookie: Boolean(setCookie),
    setCookie,
  });
};

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  console.info("[Better Auth] request", { path: url.pathname, method: "GET" });
  const response = await handler.GET(request);
  logVerifyEmail(url, response);
  return response;
};

export const POST = async (request: Request) => {
  const url = new URL(request.url);
  console.info("[Better Auth] request", { path: url.pathname, method: "POST" });
  return handler.POST(request);
};
