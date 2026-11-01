import path from "path";
import type { NextConfig } from "next";

const apiBaseUrl =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@grpc/grpc-js",
    "@grpc/proto-loader",
    "protobufjs",
    "long",
  ],
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      algosdk: "algosdk/dist/cjs/index.js",
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
