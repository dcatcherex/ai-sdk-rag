import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes that should not require authentication.
// Everything else is protected by default when auth.protect() is called below.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk",
  // LINE OA webhook verifies its own signature — must not be Clerk-protected
  "/api/line/webhook",
  // Public agent share routes
  "/agent/(.*)",
  "/api/agents/(.*)/public-share",
  // Guest-enabled public landing
  "/",
  "/api/guest/init",
  "/api/user/status",
  // Static assets / health
  "/favicon.ico",
  "/_next/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
