import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
} from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import { env } from "~/env.mjs";
import { prisma } from "~/server/db";
import { type TokenSet } from "@auth/core/types";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
    error?: string;
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  callbacks: {
    // session: ({ session, user }) => ({
    //   ...session,
    //   user: {
    //     ...session.user,
    //     id: user.id,
    //   },
    // }),
    async session({ session, user }) {
      const [google] = await prisma.account.findMany({
        where: { userId: user.id, provider: "google" },
      });
      if ((google?.expires_at || Date.now()) * 1000 < Date.now()) {
        // If the access token has expired, try to refresh it
        try {
          // https://accounts.google.com/.well-known/openid-configuration
          // We need the `token_endpoint`.
          const response = await fetch("https://oauth2.googleapis.com/token", {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: env.GOOGLE_CLIENT_ID,
              client_secret: env.GOOGLE_CLIENT_SECRET,
              grant_type: "refresh_token",
              refresh_token: google?.refresh_token as string,
            }),
            method: "POST",
          });

          const tokens: TokenSet = (await response.json()) as TokenSet;

          if (!response.ok) throw tokens;

          await prisma.account.update({
            data: {
              access_token: tokens.access_token,
              expires_at: Math.floor(
                Date.now() / 1000 + (tokens?.expires_in || 0)
              ),
              refresh_token:
                tokens.refresh_token ?? (google?.refresh_token as string),
            },
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: google?.providerAccountId as string,
              },
            },
          });
        } catch (error) {
          console.error("Error refreshing access token", error);
          // The error property will be used client-side to handle the refresh token error
          session.error = "RefreshAccessTokenError";
        }
      }
      return session;
    },
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    }),
    // GoogleProvider({
    //   clientId: env.GOOGLE_CLIENT_ID,
    //   clientSecret: env.GOOGLE_CLIENT_SECRET,
    //   authorization: { params: { access_type: "offline", prompt: "consent" } },
    // }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
