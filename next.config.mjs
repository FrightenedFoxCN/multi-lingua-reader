const isGitHubPages = process.env.GITHUB_PAGES === "true";

/** @type {import("next").NextConfig} */
const nextConfig = isGitHubPages
  ? {
      output: "export",
      assetPrefix: "/multi-lingua-reader",
    }
  : {};

export default nextConfig;
