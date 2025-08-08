'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Site } from '@/lib/api';
import { SITE_CONFIG, isSupportedForTagPrefetch, getTagDownloadSizeLabel } from '@/lib/constants';

interface SettingsModalProps {
  onClose: () => void;
}

type ConsentValue = 'accepted' | 'declined' | null;

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const supportedSites = useMemo(() => SITE_CONFIG.filter(s => isSupportedForTagPrefetch(s.value)), []);
  const [consents, setConsents] = useState<Record<Site, ConsentValue>>({} as any);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false); // dropdown open state
  const [savingSites, setSavingSites] = useState<Set<Site>>(new Set());
  const [blocklist, setBlocklist] = useState('');

  // Load blocklist from server on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        const v = (data?.blocklist || '').trim();
        if (!cancelled) setBlocklist(v);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/consent');
        const data = await res.json();
        const all: Record<Site, ConsentValue> = {} as any;
        for (const s of supportedSites) {
          const v = (data?.consents?.[s.value] ?? null) as ConsentValue;
          all[s.value] = v;
        }
        if (!cancelled) setConsents(all);
      } catch {
        // initialize to nulls if failed
        if (!cancelled) {
          const all: Record<Site, ConsentValue> = {} as any;
          for (const s of supportedSites) all[s.value] = null;
          setConsents(all);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supportedSites]);

  const cycle = (v: ConsentValue): ConsentValue => {
    if (v === 'accepted') return 'declined';
    if (v === 'declined') return null;
    return 'accepted';
  };

  const updateConsent = async (site: Site, value: ConsentValue) => {
    // optimistic update
    setConsents(prev => ({ ...prev, [site]: value }));
    setSavingSites(prev => new Set(prev).add(site));
    try {
      if (value === null) {
        await fetch(`/api/consent?site=${encodeURIComponent(site)}`, { method: 'DELETE' });
      } else {
        await fetch('/api/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site, value }),
        });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tag-consent-changed', { detail: { site, consent: value } }));
      }
    } catch {
      // revert on failure
      setConsents(prev => ({ ...prev, [site]: consents[site] }));
    } finally {
      setSavingSites(prev => {
        const next = new Set(prev);
        next.delete(site);
        return next;
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>
        <p className="modal-description">Manage preferences for uwuviewer.</p>

        {/* Single setting: Tag download consent (dropdown) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tag download consent</div>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="settings-dropdown-trigger"
              aria-expanded={open}
            >
              <span style={{ color: 'var(--text-primary)' }}>Per-site consents</span>
              <span style={{ marginLeft: 'auto', opacity: 0.7, color: 'var(--text-secondary)', fontSize: 12 }}>{supportedSites.length} sites</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 8, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {open && (
              <div className="settings-dropdown">
                {loading ? (
                  <div className="settings-row dim">Loading…</div>
                ) : (
                  supportedSites.map((s) => {
                    const v = consents[s.value] ?? null;
                    const saving = savingSites.has(s.value);
                    const label = v === 'accepted' ? 'Accepted' : v === 'declined' ? 'Declined' : 'Ask later';
                    const mark = v === 'accepted' ? '✓' : v === 'declined' ? '✕' : '•';
                    const markColor = v === 'accepted' ? '#3fb950' : v === 'declined' ? '#f85149' : 'var(--text-dim)';
                    return (
                      <button
                        key={s.value}
                        type="button"
                        className="settings-row"
                        disabled={saving}
                        onClick={() => updateConsent(s.value, cycle(v))}
                        title="Click to toggle between Accept → Decline → Ask later"
                      >
                        <Image src={s.icon} alt={s.label} width={16} height={16} className="site-icon" />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div style={{ color: 'var(--text-primary)' }}>{s.label}</div>
                          <div className="size-note">{getTagDownloadSizeLabel(s.value)} download</div>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</span>
                          <span aria-hidden style={{ color: markColor, fontWeight: 700 }}>{mark}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Blocklist tags input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Blocklist tags</div>
          <input
            type="text"
            value={blocklist}
            onChange={async (e) => {
              const v = e.target.value;
              setBlocklist(v);
              try {
                await fetch('/api/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ blocklist: v })
                });
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('blocklist-changed', { detail: { blocklist: v } }));
                }
              } catch {}
            }}
            placeholder="space-separated tags to always exclude"
            className="blocklist-input"
            style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}
          />
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>These tags will be added to every search as negatives (e.g., -tag).</div>
        </div>

        <div className="modal-buttons" style={{ marginTop: 12 }}>
          <button onClick={onClose} className="modal-button cancel">Close</button>
        </div>

        <style jsx>{`          .settings-dropdown-trigger {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .settings-dropdown-trigger:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
          }
          .settings-dropdown {
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            right: 0;
            background: var(--bg-secondary);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-md);
            padding: 6px;
            z-index: 1000;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          }
          .settings-row {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            background: transparent;
            border: none;
            border-radius: var(--radius-sm);
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: left;
          }
          .settings-row:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
          }
          .settings-row.dim {
            color: var(--text-dim);
            cursor: default;
          }
          :global(img.site-icon) {
            width: 16px;
            height: 16px;
            max-width: 16px;
            max-height: 16px;
          }
          .size-note {
            font-size: 12px;
            color: var(--text-dim);
          }
        `}</style>
      </div>
    </div>
  );
}
