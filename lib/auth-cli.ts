import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }: { email: string; token: string; url: string }) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(`Magic link for ${email}: ${url}`);
        }
      },
    }),
  ],
});
