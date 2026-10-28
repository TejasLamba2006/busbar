import { NextResponse } from "next/server";
import { FILTERS } from "./filters.js";
import { getProviderConnections } from "@/lib/localDb";
import { PROVIDERS } from "open-sse/config/providers.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const type = searchParams.get("type");
  const provider = searchParams.get("provider");

  if (!url || !type) {
    return NextResponse.json({ error: "Missing url or type" }, { status: 400 });
  }

  const filter = FILTERS[type];
  if (!filter) {
    return NextResponse.json({ error: "Unknown filter type" }, { status: 400 });
  }

  try {
    const headers = {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    };
    if (provider === "qwen-web" || url.includes("chat.qwen.ai")) {
      headers.source = "web";
      headers.Version = "0.3.26";
    }
    if (provider) {
      const cfg = PROVIDERS[provider];
      if (cfg?.headers) Object.assign(headers, cfg.headers);
      try {
        const conns = await getProviderConnections({ provider, isActive: true });
        const token = conns[0]?.apiKey || conns[0]?.accessToken;
        if (token && !headers.Authorization) {
          headers.Authorization = `Bearer ${token}`;
        }
      } catch { /* ignore */ }
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      return NextResponse.json({ data: [] });
    }
    const json = await res.json();
    const raw = json.data ?? json.models ?? json;
    // Object-shaped catalogs (minimax-code's {providers:[…]}) ride in as a
    // single-element array so every filter keeps an array input contract.
    const data = filter(Array.isArray(raw) ? raw : typeof raw === "object" && raw !== null ? [raw] : []);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
