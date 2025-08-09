'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import Image from 'next/image';
import { Site } from '@/lib/api';
import { SITE_CONFIG, isSupportedForTagPrefetch, getTagDownloadSizeLabel } from '@/lib/constants';
import ApiKeyModal from './ApiKeyModal';
import E621CredentialsModal from './E621CredentialsModal';

interface SettingsModalProps {
  onClose: () => void;
}

type ConsentValue = 'accepted' | 'declined' | null;

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const supportedSites = useMemo(() => SITE_CONFIG.filter(s => isSupportedForTagPrefetch(s.value)), []);
  const [consents, setConsents] = useState<Record<Site, ConsentValue>>({} as any);
  const [loading, setLoading] = useState(true);
  const [openConsent, setOpenConsent] = useState(false); // consent dropdown
  const [savingSites, setSavingSites] = useState<Set<Site>>(new Set());
  const [blocklist, setBlocklist] = useState('');
  const [imageType, setImageType] = useState<'preview' | 'sample'>('preview');
  const [postsPerPage, setPostsPerPage] = useState<number>(100);
  const [hasGelbooruCreds, setHasGelbooruCreds] = useState(false);
  const [hasE621Creds, setHasE621Creds] = useState(false);
  const [openApi, setOpenApi] = useState(false); // api key dropdown
  const [showGelModal, setShowGelModal] = useState(false);
  const [showE621Modal, setShowE621Modal] = useState(false);
  const [gelInput, setGelInput] = useState('');
  const [e621Login, setE621Login] = useState('');
  const [e621Key, setE621Key] = useState('');

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveSettingsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings and creds from server on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        const v = (data?.blocklist || '').trim();
        if (!cancelled) setBlocklist(v);
        if (!cancelled) setImageType(data?.imageType === 'sample' ? 'sample' : 'preview');
        if (!cancelled) setPostsPerPage(typeof data?.postsPerPage === 'number' && data.postsPerPage > 0 ? Math.floor(data.postsPerPage) : 100);
      } catch {}
      try {
        const res2 = await fetch('/api/creds');
        const data2 = await res2.json();
        if (!cancelled) {
          setHasGelbooruCreds(!!data2.gelbooru);
          setHasE621Creds(!!data2.e621);
        }
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

  // Cleanup pending saves on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (saveSettingsTimerRef.current) {
        clearTimeout(saveSettingsTimerRef.current);
        saveSettingsTimerRef.current = null;
      }
    };
  }, []);

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

  const saveSetting = (partial: any, announce: any) => {
    if (saveSettingsTimerRef.current) {
      clearTimeout(saveSettingsTimerRef.current);
      saveSettingsTimerRef.current = null;
    }
    saveSettingsTimerRef.current = setTimeout(async () => {
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('settings-changed', { detail: announce }));
        }
      } catch {}
    }, 300);
  };

  // Close on Escape to improve overlay UX
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', zIndex: 900 }}>
      <div className="settings-page" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title">Settings</div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="settings-content">


          {/* Image quality */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Image quality</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`settings-pill ${imageType === 'preview' ? 'active' : ''}`}
                onClick={() => { setImageType('preview'); saveSetting({ imageType: 'preview' }, { imageType: 'preview' }); }}
              >
                Preview (Fast)
              </button>
              <button
                type="button"
                className={`settings-pill ${imageType === 'sample' ? 'active' : ''}`}
                onClick={() => { setImageType('sample'); saveSetting({ imageType: 'sample' }, { imageType: 'sample' }); }}
              >
                Sample (HQ)
              </button>
            </div>
          </div>

          {/* Posts per page */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Posts per page</div>
            <input
              type="number"
              min={1}
              step={1}
               value={postsPerPage}
               onChange={(e) => {
                 const v = Math.max(1, Math.floor(parseInt(e.target.value || '0', 10)));
                 setPostsPerPage(v);
                 saveSetting({ postsPerPage: v }, { postsPerPage: v });
               }}
               className="posts-input"              style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}
            />
          </div>

          {/* API keys dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>API keys</div>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setOpenApi(o => !o)}
                className="settings-dropdown-trigger"
                aria-expanded={openApi}
              >
                <span style={{ color: 'var(--text-primary)' }}>Manage credentials</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transform: openApi ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', marginLeft: 'auto' }}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {openApi && (
                <div className="settings-dropdown">
                  {['gelbooru.com','e621.net'].map((val) => {
                    const s = SITE_CONFIG.find(x => x.value === val)!;
                    const has = val === 'gelbooru.com' ? hasGelbooruCreds : hasE621Creds;
                    const label = val === 'gelbooru.com' ? 'Gelbooru API Key' : 'e621 Credentials';
                    const status = has ? 'Set ✓' : 'Not set';
                    return (
                      <button
                        key={val}
                        type="button"
                        className="settings-row"
                        onClick={() => {
                          if (val === 'gelbooru.com') setShowGelModal(true); else setShowE621Modal(true);
                          setOpenApi(false);
                        }}
                      >
                        <Image src={s.icon} alt={s.label} width={16} height={16} className="site-icon" />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div style={{ color: 'var(--text-primary)' }}>{label}</div>
                          <div className="size-note">{status}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tag download consent (dropdown) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tag download consent</div>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setOpenConsent(o => !o)}
                className="settings-dropdown-trigger"
                aria-expanded={openConsent}
              >
                <span style={{ color: 'var(--text-primary)' }}>Per-site consents</span>
                <span style={{ marginLeft: 'auto', opacity: 0.7, color: 'var(--text-secondary)', fontSize: 12 }}>{supportedSites.length} sites</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 8, transform: openConsent ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {openConsent && (
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
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Blacklist tags</div>
            <input
              type="text"
              value={blocklist}
              onChange={(e) => {
                const v = e.target.value;
                setBlocklist(v);
                if (saveTimerRef.current) {
                  clearTimeout(saveTimerRef.current);
                  saveTimerRef.current = null;
                }
                saveTimerRef.current = setTimeout(async () => {
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
                }, 2000);
              }}
              placeholder="space-separated tags to always exclude"
              className="blocklist-input"
              style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}
            />

          </div>


        </div>

        <style jsx>{`
          .settings-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            z-index: 900; /* keep below nested modals (1000) */
          }
          .settings-page {
            width: calc(100% - 48px);
            height: calc(100% - 48px);
            background: var(--bg-secondary);
            border-left: none;
            border-right: none;
            margin: 24px;
            border-radius: var(--radius-lg);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 0 0 1px var(--border-default) inset;
          }
          .settings-header {
            position: sticky;
            top: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-default);
            z-index: 1;
            border-top-left-radius: var(--radius-lg);
            border-top-right-radius: var(--radius-lg);
          }
          .settings-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
          }
          .settings-close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            padding: 0;
            background: var(--bg-hover);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .settings-close:hover { background: var(--bg-active); color: var(--text-primary); }
          .settings-close-text { font-size: 13px; }
          .settings-content {
            padding: 20px;
            overflow: auto;
            flex: 1 1 auto;
          }

          .settings-dropdown-trigger {
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
          .settings-pill {
            padding: 6px 12px;
            background: var(--bg-tertiary);
            border: 1px solid transparent;
            border-radius: var(--radius-sm);
            color: var(--text-secondary);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .settings-pill:hover { background: var(--bg-hover); color: var(--text-primary); }
          .settings-pill.active { background: var(--accent); color: white; border-color: var(--accent); }
          .posts-input::-webkit-outer-spin-button,
          .posts-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          .posts-input[type='number'] { -moz-appearance: textfield; }
        `}</style>
      </div>

      {/* Credentials modals via portal */}
      {showGelModal && typeof document !== 'undefined' && ReactDOM.createPortal(
        <ApiKeyModal
          apiKeyInput={gelInput}
          onChange={setGelInput}
          onSave={async () => {
            try {
              await fetch('/api/creds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gelbooruApi: gelInput }) });
              const res = await fetch('/api/creds');
              const data = await res.json();
              setHasGelbooruCreds(!!data.gelbooru);
            } catch {}
            setGelInput('');
            setShowGelModal(false);
          }}
          onClear={async () => {
            try {
              await fetch('/api/creds', { method: 'DELETE' });
              const res = await fetch('/api/creds');
              const data = await res.json();
              setHasGelbooruCreds(!!data.gelbooru);
              setHasE621Creds(!!data.e621);
            } catch {}
          }}
          onClose={() => setShowGelModal(false)}
        />,
        document.body
      )}

      {showE621Modal && typeof document !== 'undefined' && ReactDOM.createPortal(
        <E621CredentialsModal
          login={e621Login}
          apiKey={e621Key}
          onChangeLogin={setE621Login}
          onChangeKey={setE621Key}
          onSave={async () => {
            try {
              await fetch('/api/creds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ e621Login, e621ApiKey: e621Key }) });
              const res = await fetch('/api/creds');
              const data = await res.json();
              setHasE621Creds(!!data.e621);
            } catch {}
            setE621Login('');
            setE621Key('');
            setShowE621Modal(false);
          }}
          onClear={async () => {
            try {
              await fetch('/api/creds', { method: 'DELETE' });
              const res = await fetch('/api/creds');
              const data = await res.json();
              setHasGelbooruCreds(!!data.gelbooru);
              setHasE621Creds(!!data.e621);
            } catch {}
          }}
          onClose={() => setShowE621Modal(false)}
        />,
        document.body
      )}
    </div>
  );
}
