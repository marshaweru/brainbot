// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // If your web app ever imports code from @brainbot/shared (TS/ESM),
  // this makes Next transpile it for the browser.
  transpilePackages: ["@brainbot/shared"],

  // Allow external images (e.g. Telegram avatars) when/if you use <Image>.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "t.me" },
      { protocol: "https", hostname: "telegram.org" },
      { protocol: "https", hostname: "cdn.telegram.org" },
    ],
  },

  // Source maps in production = nicer error stacks
  productionBrowserSourceMaps: true,

  // Lightweight security headers that won't break the Telegram widget
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" }, // blocks others from iframing your site
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

