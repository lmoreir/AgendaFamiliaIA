/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@agenda-familia/types",
    "@agenda-familia/services",
    "@agenda-familia/database"
  ],
};

module.exports = nextConfig;