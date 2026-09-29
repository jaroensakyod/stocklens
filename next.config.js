/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // เปิดใช้ src/instrumentation.ts (Sentry ฝั่ง server — ทำงานเฉพาะเมื่อมี NEXT_PUBLIC_SENTRY_DSN)
  experimental: { instrumentationHook: true },
};

module.exports = nextConfig;
