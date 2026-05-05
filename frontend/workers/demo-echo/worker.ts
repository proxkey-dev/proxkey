export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const json = (obj: any, init: ResponseInit = {}) =>
      new Response(JSON.stringify(obj, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, x-proxkey-policy, content-type",
          "access-control-allow-methods": "GET, OPTIONS",
          ...init.headers,
        },
        status: init.status ?? 200,
      });

    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, x-proxkey-policy, content-type",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-max-age": "86400",
        },
      });
    }

    if (url.pathname === "/demo/echo") {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      // Read demo headers (no validation, just reflect)
      const auth = req.headers.get("authorization") || null;
      const policyB64 = req.headers.get("x-proxkey-policy") || null;

      // Try to decode a base64url policy for a nicer demo
      let policy: any = null;
      if (policyB64) {
        try {
          const norm = policyB64.replace(/-/g, "+").replace(/_/g, "/");
          const decoded = atob(norm + "===".slice((norm.length + 3) % 4));
          policy = JSON.parse(decoded);
        } catch {
          // leave as null on decode failure
        }
      }

      return json({
        requestId: id,
        receivedAt: now,
        message: "ProxKey demo echo — no backend calls performed.",
        ok: true,
        echo: {
          authorization: auth,
          policy: policy ?? { note: "Send X-ProxKey-Policy as base64url(JSON) to see it decoded." },
        },
        tips: [
          "Use this endpoint for live demos without touching your DB.",
          "Headers: Authorization: Bearer <token>, X-ProxKey-Policy: <base64url(JSON)>",
        ],
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
