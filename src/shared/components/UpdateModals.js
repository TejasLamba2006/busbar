"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Button from "./Button";
import Modal from "./Modal";

const SEEN_KEY = "busbar_last_seen_version";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll while the server is down (fetch errors / 502 are expected) until it reports `target`.
// 45 x 2s = 90s. Returns { ok, error }.
export async function pollUntilUpdated(target, tries = 45) {
  for (let i = 0; i < tries; i++) {
    await wait(2000);
    try {
      const r = await fetch("/api/system/update", { cache: "no-store" });
      if (!r.ok) continue;
      const d = await r.json();
      if (d.currentVersion === target) return { ok: true };
      if (d.status !== "updating" && d.status !== "restarting" && d.lastUpdateError) return { ok: false, error: d.lastUpdateError };
    } catch { /* server restarting */ }
  }
  return { ok: false, error: "Server did not come back in time. Reload manually." };
}

function Notes({ text }) {
  if (!text) return <p className="text-sm text-text-muted">No release notes published.</p>;
  return <pre className="text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto p-3 rounded-lg bg-bg border border-border">{text}</pre>;
}
Notes.propTypes = { text: PropTypes.string };

export function ConfirmUpdateModal({ isOpen, info, busy, error, onCancel, onConfirm }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onCancel()}
      title="Update Busbar"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm} loading={busy}>Update Now</Button>
        </>
      }
    >
      <p className="text-sm font-medium mb-2">v{info?.currentVersion} → v{info?.latestVersion}</p>
      <Notes text={info?.latestReleaseNotes} />
      <p className="text-xs text-text-muted mt-2">Busbar will stop, install the update, and restart. This takes about 30 seconds.</p>
      {error && <p className="text-sm text-red-500 mt-2 break-all">{error}</p>}
    </Modal>
  );
}
ConfirmUpdateModal.propTypes = {
  isOpen: PropTypes.bool, info: PropTypes.object, busy: PropTypes.bool, error: PropTypes.string,
  onCancel: PropTypes.func, onConfirm: PropTypes.func,
};

// Shows once after an update finished (server flag justAutoUpdatedTo, plus localStorage guard).
export function WhatsNewModal() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/system/update", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.justAutoUpdatedTo) return;
        let seen = null;
        try { seen = localStorage.getItem(SEEN_KEY); } catch { /* no storage */ }
        if (seen === d.currentVersion) {
          fetch("/api/system/update", { method: "DELETE" }).catch(() => {});
          return;
        }
        setInfo(d);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, info.currentVersion); } catch { /* no storage */ }
    fetch("/api/system/update", { method: "DELETE" }).catch(() => {});
    setInfo(null);
  };

  return (
    <Modal
      isOpen={!!info}
      onClose={dismiss}
      title={`Updated to v${info?.currentVersion} - What's New`}
      footer={<Button variant="primary" onClick={dismiss}>Got it</Button>}
    >
      <Notes text={info?.currentReleaseNotes} />
    </Modal>
  );
}
