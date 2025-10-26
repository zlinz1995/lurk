/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: '.next-dev',
  reactStrictMode: false,
  output: 'export',
  // Avoid writing the build dependency trace file that OneDrive can lock
  // See: https://nextjs.org/docs/messages/production-start-no-build-id
  outputFileTracing: false,
};

export default nextConfig;
