/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack ko force-stop karne ke liye
  turbopack: {},

  // Solana ke liye zaruri webpack polyfills
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;

