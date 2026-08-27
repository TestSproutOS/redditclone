import { proxyApiRequest } from "@website/lib/api-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ route?: string[] }> };

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { route = [] } = await context.params;
  return proxyApiRequest(request, route);
}

export const GET = handle;
export const HEAD = handle;
export const OPTIONS = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
