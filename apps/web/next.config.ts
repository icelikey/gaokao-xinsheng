import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@gaokao-xinsheng/contracts", "@gaokao-xinsheng/ai-tutor", "@gaokao-xinsheng/grader"],
  typedRoutes: true
};

export default nextConfig;
