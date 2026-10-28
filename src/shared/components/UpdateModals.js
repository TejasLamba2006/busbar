"use client";

import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { marked } from "marked";
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

export function Notes({ text }) {
  const html = useMemo(() => {
    if (!text) return "";
    marked.setOptions({ gfm: true, breaks: true });
    return marked.parse(text);
  }, [text]);
  if (!text) return <p className="text-sm text-text-muted">No release notes published.</p>;
  return (
    <div
      className="changelog-body text-xs leading-relaxed break-words max-h-64 overflow-auto p-3 rounded-lg bg-bg border border-border text-text-main"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
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

// All releases, newest first. Opened from the header "Changelogs" button.
export function ChangelogsModal({ isOpen, onClose }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    fetch("/api/system/update", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setInfo(d))
      .catch(() => alive && setInfo({ releases: [] }));
    return () => { alive = false; };
  }, [isOpen]);

  const releases = info?.releases || [];
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="All Changelogs" footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
      <div className="max-h-[60vh] overflow-auto flex flex-col gap-4">
        {info?.updateAvailable && (
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            Update Available: v{info.latestVersion} (you run v{info.currentVersion})
          </div>
        )}
        {!info && <p className="text-sm text-text-muted">Loading...</p>}
        {info && releases.length === 0 && <p className="text-sm text-text-muted">No releases found.</p>}
        {releases.map((r) => (
          <div key={r.tag} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">v{r.version}</span>
              {r.version === info.currentVersion && (
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">Current</span>
              )}
              {r.publishedAt && <span className="text-xs text-text-muted">{new Date(r.publishedAt).toLocaleDateString()}</span>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-primary hover:underline">
                  View on GitHub
                </a>
              )}
            </div>
            <Notes text={r.notes.trim()} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
ChangelogsModal.propTypes = { isOpen: PropTypes.bool, onClose: PropTypes.func };
