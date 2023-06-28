import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { api } from "~/utils/api";
import "~/styles/globals.css";
import { ThemeProvider } from "~/components/theme-provider";
import Navbar from "~/components/Navbar/Navbar";
import PlausibleProvider from "next-plausible";
import { env } from "~/env.mjs";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <PlausibleProvider
        domain={env.NEXT_PUBLIC_ANALYTICS_SITE_NAME}
        customDomain={env.NEXT_PUBLIC_ANALYTICS_URL}
        selfHosted={true}
        trackOutboundLinks={true}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <Navbar />
          <Component {...pageProps} />
        </ThemeProvider>
      </PlausibleProvider>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
