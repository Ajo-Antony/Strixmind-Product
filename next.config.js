/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  distDir: process.env.NODE_ENV === 'production' ? '.next' : '.next-dev',
}
module.exports = nextConfig
