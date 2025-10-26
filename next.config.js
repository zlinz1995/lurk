/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: '.next-dev',
  reactStrictMode: false,
  // Only use static export when explicitly requested
  output: process.env.NEXT_EXPORT === '1' ? 'export' : undefined,
  // Avoid writing the build dependency trace file that OneDrive can lock
  // See: https://nextjs.org/docs/messages/production-start-no-build-id
  outputFileTracing: false,
};

export default nextConfig;
