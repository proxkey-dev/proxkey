export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Accept optional passthrough params (issuer/type/etc.) for pretty demos
    const issuer = url.searchParams.get("issuer") ?? "ProxKey";
    const subject = url.searchParams.get("subject") ?? "Acme Inc.";
    const type = url.searchParams.get("type") ?? "Company";
    const ttl = url.searchParams.get("ttl") ?? "60";
    const max = url.searchParams.get("max") ?? "1000";
    const geo = url.searchParams.get("geo") ?? "US,CA";
    const blockSameIp = url.searchParams.get("blockSameIp") ?? "true";

    // Build redirect to your public site page (no backend usage)
    const target = new URL("https://proxkey.dev/demo/qr");
    target.searchParams.set("key", "demo");
    target.searchParams.set("issuer", issuer);
    target.searchParams.set("subject", subject);
    target.searchParams.set("type", type);
    target.searchParams.set("ttl", ttl);
    target.searchParams.set("max", max);
    target.searchParams.set("geo", geo);
    target.searchParams.set("blockSameIp", blockSameIp);

    return new Response(null, {
      status: 302,
      headers: { Location: target.toString(), "Cache-Control": "no-store" },
    });
  }
} satisfies ExportedHandler;
