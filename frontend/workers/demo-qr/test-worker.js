// Simple test script for the Cloudflare Worker
// This simulates what the worker would do

function testWorker() {
  // Simulate the worker logic
  const testUrl = "https://proxkey-demo.workers.dev/demo/echo?issuer=ProxKey&subject=Demo%20User&type=Person&ttl=30&max=500&geo=US,CA,UK&blockSameIp=true";
  
  const url = new URL(testUrl);
  
  // Extract parameters
  const issuer = url.searchParams.get("issuer") ?? "ProxKey";
  const subject = url.searchParams.get("subject") ?? "Acme Inc.";
  const type = url.searchParams.get("type") ?? "Company";
  const ttl = url.searchParams.get("ttl") ?? "60";
  const max = url.searchParams.get("max") ?? "1000";
  const geo = url.searchParams.get("geo") ?? "US,CA";
  const blockSameIp = url.searchParams.get("blockSameIp") ?? "true";

  // Build redirect URL
  const target = new URL("https://proxkey.dev/demo/qr");
  target.searchParams.set("key", "demo");
  target.searchParams.set("issuer", issuer);
  target.searchParams.set("subject", subject);
  target.searchParams.set("type", type);
  target.searchParams.set("ttl", ttl);
  target.searchParams.set("max", max);
  target.searchParams.set("geo", geo);
  target.searchParams.set("blockSameIp", blockSameIp);

  console.log("Test URL:", testUrl);
  console.log("Redirect to:", target.toString());
  console.log("Status: 302");
  console.log("Headers: { Location: '" + target.toString() + "', 'Cache-Control': 'no-store' }");
  
  return {
    status: 302,
    headers: { 
      Location: target.toString(), 
      "Cache-Control": "no-store" 
    }
  };
}

// Run the test
const result = testWorker();
console.log("\nWorker test result:", result);
