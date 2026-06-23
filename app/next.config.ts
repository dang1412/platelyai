import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Avatar Google trả về từ domain này (next/image cần cho phép tường minh).
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
