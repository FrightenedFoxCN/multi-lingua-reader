import { resolveLanguageInitialization } from "../../../language-resources.js";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const name = url.searchParams.get("name") || "";
  if (!code.trim() && !name.trim()) {
    return Response.json(
      { error: "需要语言代码或名称" },
      { status: 400 },
    );
  }

  return Response.json(resolveLanguageInitialization({ code, name }), {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}

