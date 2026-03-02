import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Necessário para Docker multi-stage build
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/gui-dev-br.appspot.com/o/amazarashi**",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["*.gui.dev.br"],
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
