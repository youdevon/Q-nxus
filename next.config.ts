import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LAN / alternate-host access in `next dev` (HMR + /_next/*).
  allowedDevOrigins: ["10.1.5.37"],
  experimental: {
    serverActions: {
      // Matches 15 MB attachment cap with multipart/form-field headroom.
      bodySizeLimit: "16mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/leave",
        destination: "/people/leave",
        permanent: true,
      },
      {
        source: "/leave/:path*",
        destination: "/people/leave/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
