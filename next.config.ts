import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100";
let apiHostname = "localhost";
let apiProtocol: "http" | "https" = "http";
let apiPort: string | undefined = "4100";
try {
  const parsed = new URL(apiUrl);
  apiHostname = parsed.hostname;
  apiProtocol = parsed.protocol.replace(":", "") as "http" | "https";
  apiPort = parsed.port || undefined;
} catch {
  // keep defaults
}

const backendOrigin = apiUrl.replace(/\/$/, "");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: apiProtocol,
        hostname: apiHostname,
        ...(apiPort ? { port: apiPort } : {}),
        pathname: "/api/files/**",
      },
    ],
  },
  // Browser calls /api/* same-origin; unmatched paths proxy to BE (avoids CORS).
  async rewrites() {
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${backendOrigin}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
