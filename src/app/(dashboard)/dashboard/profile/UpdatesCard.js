"use client";

import { useState, useEffect } from "react";
import { Card, Button, Toggle } from "@/shared/components";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default function UpdatesCard({ autoUpdate, onAutoUpdateChange }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = () => fetch("/api/system/update").then((r) => r.json()).then(setInfo).catch(() => {});
  useEffect(() => { load(); }, []);

  const updateNow = async () => {
    setBusy(true);
    setMsg({ type: "", text: "Checking and installing..." });
    try {
      const res = await fetch("/api/system/update", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setMsg({ type: "error", text: data.error || "Update failed" });
        setBusy(false);
        return;
      }
      setMsg({ type: "ok", text: `Installed v${data.updatedTo}. Restarting...` });
      // Poll until the server is back on the new version, then reload.
      for (let i = 0; i < 60; i++) {
        await wait(2000);
        try {
          const r = await fetch("/api/system/update", { cache: "no-store" });
          const d = await r.json();
          if (d.currentVersion === data.updatedTo) { globalThis.location.reload(); return; }
        } catch { /* server restarting */ }
      }
      setMsg({ type: "error", text: "Server did not come back in time. Reload manually." });
    } catch {
      setMsg({ type: "error", text: "Update request failed" });
    }
    setBusy(false);
  };

  const status = !info ? "Checking..." : info.updateAvailable ? `Update available: v${info.latestVersion}` : "Up to date";

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">system_update_alt</span>
        </div>
        <h3 className="text-base sm:text-lg font-semibold">Updates</h3>
      </div>
      <p className="text-sm text-text-muted mb-3">
        Current version: v{info?.currentVersion || "..."} ({status})
      </p>
      <div className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border mb-3">
        <div>
          <p className="font-medium text-sm sm:text-base">Auto-update in background</p>
          <p className="text-xs sm:text-sm text-text-muted">Installs new releases from npm and restarts automatically.</p>
        </div>
        <Toggle checked={autoUpdate === true} onChange={() => onAutoUpdateChange(!autoUpdate)} />
      </div>
      <Button variant="primary" icon="download" onClick={updateNow} loading={busy}>
        Check &amp; Update Now
      </Button>
      {msg.text && (
        <p className={`text-sm mt-2 ${msg.type === "error" ? "text-red-500" : "text-text-muted"}`}>{msg.text}</p>
      )}
      {info?.lastUpdateError && !msg.text && (
        <p className="text-xs mt-2 text-red-500 break-all">Last error: {info.lastUpdateError}</p>
      )}
    </Card>
  );
}
