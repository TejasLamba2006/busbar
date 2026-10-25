"use client";

import { useState, useEffect } from "react";
import { Card, Button, Toggle } from "@/shared/components";
import { ConfirmUpdateModal, pollUntilUpdated } from "@/shared/components/UpdateModals";

export default function UpdatesCard({ autoUpdate, onAutoUpdateChange }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = () => fetch("/api/system/update").then((r) => r.json()).then(setInfo).catch(() => {});
  useEffect(() => { load(); }, []);

  const [confirm, setConfirm] = useState(null);
  const [confirmError, setConfirmError] = useState("");

  // Step 1: check only. Never installs without the confirm modal.
  const checkNow = async () => {
    setBusy(true);
    setMsg({ type: "", text: "Checking for updates..." });
    try {
      const d = await (await fetch("/api/system/update?force=1", { cache: "no-store" })).json();
      setInfo(d);
      if (d.updateAvailable) { setConfirmError(""); setConfirm(d); setMsg({ type: "", text: "" }); }
      else setMsg({ type: "ok", text: "Already up to date." });
    } catch {
      setMsg({ type: "error", text: "Update check failed" });
    }
    setBusy(false);
  };

  // Step 2: confirmed. Server hands off to the detached worker, goes down, comes back on the new version.
  const installNow = async () => {
    setBusy(true);
    setConfirmError("");
    try {
      const res = await fetch("/api/system/update", { method: "POST" });
      const data = await res.json();
      if (!data.success) { setConfirmError(data.error || "Update failed"); setBusy(false); return; }
      setConfirm(null);
      setMsg({ type: "ok", text: `Installing v${data.updatedTo} and restarting. This takes about 30 seconds...` });
      const r = await pollUntilUpdated(data.updatedTo);
      if (r.ok) { globalThis.location.reload(); return; }
      setMsg({ type: "error", text: r.error });
    } catch {
      setConfirmError("Update request failed");
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
      <Button variant="primary" icon="download" onClick={checkNow} loading={busy}>
        Check &amp; Update Now
      </Button>
      {msg.text && (
        <p className={`text-sm mt-2 ${msg.type === "error" ? "text-red-500" : "text-text-muted"}`}>{msg.text}</p>
      )}
      {info?.lastUpdateError && !msg.text && (
        <p className="text-xs mt-2 text-red-500 break-all">Last error: {info.lastUpdateError}</p>
      )}
      <ConfirmUpdateModal
        isOpen={!!confirm}
        info={confirm}
        busy={busy}
        error={confirmError}
        onCancel={() => setConfirm(null)}
        onConfirm={installNow}
      />
    </Card>
  );
}
