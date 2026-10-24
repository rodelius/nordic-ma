import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  // GitHub Codespaces forwards the development server through HTTPS.
  allowedDevOrigins: ['127.0.0.1', '*.app.github.dev'],
};
export default nextConfig;
