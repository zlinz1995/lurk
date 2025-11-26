/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  // ❗ Do NOT set distDir for static exports unless you REALLY know why.
  // Avoid writing the build dependency trace file that OneDrive can lock
  // See: https://nextjs.org/docs/messages/production-start-no-build-id
  outputFileTracing: false,
};

export default nextConfig;
