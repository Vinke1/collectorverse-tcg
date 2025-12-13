/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
};

// En développement avec Turbopack : config simple sans plugins Webpack
// En production/build : PWA + bundle analyzer (optionnel)
const isDev = process.env.NODE_ENV === "development";
const isAnalyze = process.env.ANALYZE === "true";

if (isDev) {
  // Turbopack : pas de plugins Webpack pour éviter les warnings
  module.exports = nextConfig;
} else {
  // Production : PWA activé
  const withPWA = require("@ducanh2912/next-pwa").default({
    dest: "public",
    register: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        // Exclure les routes d'authentification du cache
        urlPattern: /^https?:\/\/[^/]+\/auth\/.*/i,
        handler: "NetworkOnly",
      },
    ],
  });

  if (isAnalyze) {
    const withBundleAnalyzer = require("@next/bundle-analyzer")({
      enabled: true,
    });
    module.exports = withBundleAnalyzer(withPWA(nextConfig));
  } else {
    module.exports = withPWA(nextConfig);
  }
}
