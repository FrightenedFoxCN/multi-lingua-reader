export const deploymentBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const isStaticDeployment = process.env.NEXT_PUBLIC_STATIC_DEPLOYMENT === "true";

export function sitePath(path = "/") {
  if (!deploymentBasePath || !path.startsWith("/")) return path;
  if (path === "/") return `${deploymentBasePath}/`;
  return `${deploymentBasePath}${path}`;
}

export function serverApiPath(path) {
  if (isStaticDeployment) {
    throw new Error("GitHub Pages 静态站不提供服务器接口，请在本地运行完整版本。");
  }
  return path;
}
