/** @type {import('next').NextConfig} */
const nextConfig = {
  // Images are loaded from external placeholder hosts via plain <img> tags,
  // so no remotePatterns config is needed.
  // Bundle the SQLite database into the serverless function output so it is
  // available on Vercel (src/lib/db.ts copies it to /tmp at runtime).
  outputFileTracingIncludes: {
    "/**": ["./prisma/dev.db"],
  },
};

export default nextConfig;
