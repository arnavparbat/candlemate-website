import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Lets a release preview run beside a dev server without sharing its transient cache.
  distDir:
    process.env.NEXT_DIST_DIR ||
    (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
};
export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
