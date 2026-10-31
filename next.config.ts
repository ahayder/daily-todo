import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST || "localhost";
const internalPort = process.env.PORT || "5005";

// NEXT_PUBLIC_* values are baked into the bundle. Dev auto-login credentials must
// never reach a production (web or desktop) build.
const devAutoLoginVars = Object.keys(process.env).filter(
  (key) => key.startsWith("NEXT_PUBLIC_DEV_AUTO_LOGIN_") && process.env[key]?.trim(),
);
if (isProd && devAutoLoginVars.length > 0) {
  throw new Error(
    `Refusing to build: ${devAutoLoginVars.join(", ")} would be baked into the app. ` +
      "Move them to .env.development.local (Next only loads that file for `next dev`).",
  );
}

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  assetPrefix: isProd ? undefined : `http://${internalHost}:${internalPort}`,
};

export default nextConfig;
