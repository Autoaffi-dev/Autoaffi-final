/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // ✅ Google profile images (NextAuth)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },

      // (valfritt) om du även renderar Supabase Storage images:
      // { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

module.exports = nextConfig;