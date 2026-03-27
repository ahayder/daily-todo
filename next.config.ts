import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST || "localhost";
const internalPort = process.env.PORT || "5005";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  assetPrefix: isProd ? undefined : `http://${internalHost}:${internalPort}`,
};

export default nextConfig;
