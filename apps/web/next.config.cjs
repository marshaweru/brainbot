// apps/web/next.config.cjs
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      a: path.resolve(__dirname), // "a/*" -> apps/web/*
    };
    return config;
  },
};

module.exports = nextConfig;
