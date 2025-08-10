"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { ImageBoardAPI, UnifiedPost, Site } from '@/lib/api';
import ImageCard from '@/components/ImageCard';
import ImageViewer from '@/components/ImageViewer';
import SearchBar from '@/components/SearchBar';
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal';
import { toast } from 'sonner';
import { DEFAULT_RATING_BY_SITE, isSupportedForTagPrefetch, getTagDownloadSizeLabel } from '@/lib/constants';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
// We avoid Next's router for URL updates to prevent client navigations

// Collapsible spinner used while preparing tags. Implemented as a proper
// React component (so hooks are safe) and rendered via toast.custom.
function formatBytes(n: number): string {
  if (!n || n <= 0) return '0 B';
  const units = ['B','KB','MB','GB','TB'];
  let idx = 0;
  let val = n as number;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${units[idx]}`;
}

function CollapsiblePrefetchToast({ targetSite, onCollapse, onCancel }: { targetSite: Site; onCollapse: () => void; onCancel: () => void }) {
  const [bytes, setBytes] = useState(0);
  useEffect(() => {
    const onProg = (e: any) => {
      const s = e?.detail?.site as Site | undefined;
      const b = e?.detail?.bytes as number | undefined;
      if (s === targetSite && typeof b === 'number') setBytes(b);
    };
    if (typeof window !== 'undefined') window.addEventListener('tag-progress', onProg as any);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('tag-progress', onProg as any); };
  }, [targetSite]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: 14,
        minWidth: 300,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--accent)' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Preparing tags</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={onCancel}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
              }}
              aria-label="Cancel"
              title="Cancel"
            >
              Cancel
            </button>
            <button
              onClick={onCollapse}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Hide"
              title="Hide"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2" y="5.5" width="8" height="1" rx="0.5" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Downloading tags for {targetSite}…</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Downloaded {formatBytes(bytes)} so far</div>
        <div style={{ width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 9999, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <div style={{ width: '40%', height: '100%', background: 'var(--accent)', animation: 'indeterminate 1.2s ease-in-out infinite', borderRadius: 9999 }} />
        </div>
        <style jsx>{`
          @keyframes indeterminate {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(50%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function Home() {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<UnifiedPost | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [site, setSite] = useState<Site>('yande.re');
  const [searchTags, setSearchTags] = useState('rating:safe'); // Initialize with default rating for yande.re
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [imageType, setImageType] = useState<'preview' | 'sample'>('preview');
  const [apiKey, setApiKey] = useState('');
  const [limit, setLimit] = useState<number>(100);
  const [e621Login, setE621Login] = useState<string>('');
  const [e621ApiKey, setE621ApiKey] = useState<string>('');
  const [tagPromptSite, setTagPromptSite] = useState<Site | null>(null);
  const [blocklist, setBlocklist] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Track mobile viewport to adjust minimized capsule position
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  
  const apiRef = useRef<ImageBoardAPI>(new ImageBoardAPI(site, apiKey, { login: e621Login, apiKey: e621ApiKey }));
  const loadingRef = useRef(false);
  const postsAbortRef = useRef<AbortController | null>(null);
  const postsRequestIdRef = useRef(0);

  // URL helpers for state sync (no Next navigation)
  const pendingNavRef = useRef<null | { type: 'search'; tags: string }>(null);
  const prevPathRef = useRef<string>('');
  const getPathname = () => (typeof window !== 'undefined' ? window.location.pathname : '/');
  const setUrl = useCallback((path: string, mode: 'push' | 'replace' = 'push') => {
    if (typeof window === 'undefined') return;
    if (getPathname() === path) return;
    try {
      if (mode === 'replace') window.history.replaceState({}, '', path);
      else window.history.pushState({}, '', path);
    } catch {}
  }, []);

  const isValidSite = useCallback((s: string): s is Site => {
    return Object.prototype.hasOwnProperty.call(DEFAULT_RATING_BY_SITE, s);
  }, []);

  const defaultTagsFor = useCallback((s: Site): string => {
    return (DEFAULT_RATING_BY_SITE[s] ?? '').trim();
  }, []);

  const buildPath = useCallback((s: Site, tags: string, p: number): string => {
    const def = defaultTagsFor(s);
    const t = (tags || '').trim();
    const tagsChanged = t !== def;
    if (tagsChanged) {
      let path = `/${s}/search/${encodeURIComponent(t)}`;
      if (p > 1) path += `/${p}`;
      return path;
    }
    // default tags
    if (p > 1) return `/${s}/${p}`;
    return `/${s}`;
  }, [defaultTagsFor]);

  // Parse the current pathname once on mount (direct visit) and hydrate state
  useEffect(() => {
    const initPrefetchDoneRef = { current: false } as { current: boolean };
    const runPrefetchOnce = (target: Site) => {
      if (!initPrefetchDoneRef.current) {
        maybePromptOrAutoPrefetch(target);
        initPrefetchDoneRef.current = true;
      }
    };

    const raw = getPathname();
    const segs = raw.split('/').filter(Boolean).map((x) => {
      try { return decodeURIComponent(x); } catch { return x; }
    });
    if (segs.length === 0) {
      // root -> leave defaults and prefetch for default site
      runPrefetchOnce(site);
      return;
    }

    const s0 = segs[0];
    if (!isValidSite(s0)) return; // unknown; ignore
    const newSite = s0 as Site;

    // posts route: do not change search/page; only ensure site matches
    if (segs[1] === 'posts') {
      if (site !== newSite) {
        setSite(newSite);
        const def = defaultTagsFor(newSite);
        if (searchTags.trim() === '' || searchTags === defaultTagsFor(site)) {
          setSearchTags(def);
        }
      }
      runPrefetchOnce(newSite);
      return;
    }

    let newTags = defaultTagsFor(newSite);
    let newPage = 1;

    if (segs[1] === 'search') {
      if (typeof segs[2] === 'string') newTags = segs[2];
      if (typeof segs[3] === 'string' && /^\d+$/.test(segs[3])) newPage = Math.max(1, parseInt(segs[3], 10));
    } else if (typeof segs[1] === 'string' && /^\d+$/.test(segs[1])) {
      newPage = Math.max(1, parseInt(segs[1], 10));
    } else {
      newTags = defaultTagsFor(newSite);
      newPage = 1;
    }

    if (site !== newSite) setSite(newSite);
    if (searchTags !== newTags) setSearchTags(newTags);
    if (page !== newPage) {
      setPage(newPage);
      setPosts([]);
      if (site === newSite && searchTags === newTags) {
        loadPosts(newPage, true, newTags);
      }
    }

    runPrefetchOnce(newSite);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build explicit columns and distribute posts row-first to preserve masonry look but change order
  const [columnCount, setColumnCount] = useState<number>(5);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const w = window.innerWidth;
      let n = 5;
      if (w <= 480) n = 1;
      else if (w <= 768) n = 2;
      else if (w <= 1024) n = 3;
      else if (w <= 1400) n = 4;
      else n = 5;
      setColumnCount(n);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // Abort any in-flight posts request on unmount
  useEffect(() => {
    return () => {
      try { postsAbortRef.current?.abort(); } catch {}
    };
  }, []);

  const columns = useMemo(() => {
    const cols = Math.max(1, columnCount | 0);
    const buckets: UnifiedPost[][] = Array.from({ length: cols }, () => []);
    posts.forEach((post, idx) => {
      buckets[idx % cols].push(post);
    });
    return buckets;
  }, [posts, columnCount]);

  const loadPosts = useCallback(async (pageNum: number, reset = false, tags?: string) => {
    if (loadingRef.current && !reset) return;

    // Abort any in-flight posts request when a new one starts
    if (postsAbortRef.current) {
      try { postsAbortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    postsAbortRef.current = controller;

    // Increment request id and capture it for this invocation
    const currentReqId = ++postsRequestIdRef.current;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Build effective tags by appending server-stored blocklist as negatives
      const baseTags = (tags ?? searchTags) || '';
      const bl = (blocklist || '').trim();
      const neg = bl ? bl.split(/\s+/).filter(Boolean).map(t => t.startsWith('-') ? t : `-${t}`).join(' ') : '';
      const effectiveTags = neg ? (baseTags ? `${baseTags} ${neg}` : neg) : baseTags;

      const newPosts = await apiRef.current.getPosts(
        {
          page: pageNum,
          limit: limit,
          tags: effectiveTags,
        },
        { signal: controller.signal }
      );

      // If a newer request started, ignore this response
      if (currentReqId !== postsRequestIdRef.current) return;

      if (newPosts.length === 0) {
        setHasMore(false);
        if (reset) {
          setPosts([]);
        }
      } else {
        setPosts(prevPosts => reset ? newPosts : [...prevPosts, ...newPosts]);
        setHasMore(newPosts.length === limit);
      }
      setIsInitialLoad(false);
    } catch (err: any) {
      // Ignore aborted requests
      if (!(err && err.name === 'AbortError')) {
        // Only set error if this request is still the latest
        if (currentReqId === postsRequestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load posts');
          setHasMore(false);
        }
      }
    } finally {
      // Only clear loading if this is still the latest request
      if (currentReqId === postsRequestIdRef.current) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  }, [searchTags, limit, blocklist]);

  useEffect(() => {
    apiRef.current = new ImageBoardAPI(site, apiKey, { login: e621Login, apiKey: e621ApiKey });
    setPosts([]);
    setHasMore(true);
    setIsInitialLoad(true);
    loadPosts(page, true, searchTags);
  }, [site, searchTags, apiKey, e621Login, e621ApiKey, loadPosts, page]);

  // Gallery keyboard navigation with proper masonry layout handling
  const handleGalleryNavigation = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (selectedPost) return; // Don't navigate gallery when viewer is open
    
    const totalPosts = posts.length;
    if (totalPosts === 0) return;
    
    // If no item is selected yet, start from the first item
    let currentIndex = selectedIndex;
    if (currentIndex === -1) {
      currentIndex = 0;
      setSelectedIndex(0);
      return;
    }
    
    let newIndex = currentIndex;
    
    // For masonry layout, we need to calculate position based on how items are distributed
    // Items are distributed round-robin: post 0 -> col 0, post 1 -> col 1, etc.
    const currentCol = currentIndex % columnCount;
    const currentRow = Math.floor(currentIndex / columnCount);
    
    if (direction === 'right') {
      // Move to next column, same row
      if (currentCol < columnCount - 1) {
        // Check if there's an item in the next column at this row
        const nextIndex = currentRow * columnCount + (currentCol + 1);
        if (nextIndex < totalPosts) {
          newIndex = nextIndex;
        }
      }
    } else if (direction === 'left') {
      // Move to previous column, same row
      if (currentCol > 0) {
        const prevIndex = currentRow * columnCount + (currentCol - 1);
        if (prevIndex >= 0) {
          newIndex = prevIndex;
        }
      }
    } else if (direction === 'down') {
      // Move to same column, next row
      const nextIndex = (currentRow + 1) * columnCount + currentCol;
      if (nextIndex < totalPosts) {
        newIndex = nextIndex;
      }
    } else if (direction === 'up') {
      // Move to same column, previous row
      if (currentRow > 0) {
        const prevIndex = (currentRow - 1) * columnCount + currentCol;
        newIndex = prevIndex;
      }
    }
    
    if (newIndex !== selectedIndex && newIndex >= 0 && newIndex < totalPosts) {
      setSelectedIndex(newIndex);
      
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        // Find the actual element with the selected class
        const selectedElement = document.querySelector('.image-card-wrapper.selected');
        if (selectedElement) {
          // Only scroll if element is not fully visible
          const rect = selectedElement.getBoundingClientRect();
          const isFullyVisible = (
            rect.top >= 100 && // Account for header
            rect.bottom <= window.innerHeight &&
            rect.left >= 0 &&
            rect.right <= window.innerWidth
          );
          
          if (!isFullyVisible) {
            selectedElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest',
              inline: 'nearest'
            });
          }
        }
      });
    }
  }, [selectedIndex, posts, columnCount, selectedPost]);

  const handleOpenSelected = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < posts.length && !selectedPost) {
      const post = posts[selectedIndex];
      if (typeof window !== 'undefined') {
        prevPathRef.current = getPathname();
        try { setUrl(`/${site}/posts/${post.id}`, 'push'); } catch {}
      }
      setSelectedPost(post);
    }
  }, [selectedIndex, posts, selectedPost, site, getPathname, setUrl]);

  const handleFocusSearch = useCallback(() => {
    // Focus on search input - you'll need to pass a ref from SearchBar
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }, []);

  const handleToggleHeader = useCallback(() => {
    setHeaderHidden(prev => !prev);
  }, []);

  const handleToggleSettings = useCallback(() => {
    // Trigger settings modal - you'll need to pass this to SearchBar
    const settingsButton = document.querySelector('[aria-label*="Settings"]') as HTMLButtonElement;
    if (settingsButton) {
      settingsButton.click();
    }
  }, []);

  // Keyboard shortcuts will be setup after handleSiteChange is defined

  // Load blocklist from server and listen for changes
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
    const onChanged = (e: any) => {
      const v = (e?.detail?.blocklist || '').trim();
      setBlocklist(v);
    };
    if (typeof window !== 'undefined') window.addEventListener('blocklist-changed', onChanged as any);
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') window.removeEventListener('blocklist-changed', onChanged as any);
    };
  }, []);

  // Load image settings (imageType, postsPerPage) from server and listen for changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (!cancelled) {
          if (data?.imageType === 'preview' || data?.imageType === 'sample') {
            setImageType(data.imageType);
          }
          if (typeof data?.postsPerPage === 'number' && data.postsPerPage > 0) {
            setLimit(Math.max(1, Math.floor(data.postsPerPage)));
          }
        }
      } catch {}
    })();

    const onSettings = (e: any) => {
      const it = e?.detail?.imageType as 'preview' | 'sample' | undefined;
      const pp = e?.detail?.postsPerPage as number | undefined;
      if (it === 'preview' || it === 'sample') {
        setImageType(it);
      }
      if (typeof pp === 'number' && pp > 0) {
        setLimit(Math.max(1, Math.floor(pp)));
        // Reset to page 1 and reload
        setPosts([]);
        setPage(1);
        setHasMore(true);
        setError(null);
        loadPosts(1, true);
      }
    };

    if (typeof window !== 'undefined') window.addEventListener('settings-changed', onSettings as any);
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') window.removeEventListener('settings-changed', onSettings as any);
    };
  }, [loadPosts]);

  // Initial tag prefetch will be triggered from the URL-parse effect to honor the URL's site


  const handlePageChange = useCallback((newPage: number) => {
    if (newPage !== page && !loadingRef.current) {
      setPage(newPage);
      setPosts([]);
      loadPosts(newPage, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try { setUrl(buildPath(site, searchTags, newPage), 'push'); } catch {}
    }
  }, [page, loadPosts, buildPath, site, searchTags, setUrl]);

  // Start tags prefetch for supported sites with a toast
  const prefetchingSitesRef = useRef<Set<Site>>(new Set());
  const toastIdsRef = useRef<Map<Site, string | number>>(new Map());
  const cancelledPrefetchSitesRef = useRef<Set<Site>>(new Set());
  const [minimizedPrefetchSites, setMinimizedPrefetchSites] = useState<Set<Site>>(new Set());
  const sseRefs = useRef<Map<Site, EventSource>>(new Map());
  const [progressPerSite, setProgressPerSite] = useState<Map<Site, number>>(new Map());

  // Helper: small, clickable toast that dismisses on click
  const quickToast = useCallback((kind: 'success' | 'error' | 'message', text: string) => {
    const accent = kind === 'success' ? '#3fb950' : kind === 'error' ? '#f85149' : 'var(--accent)';
    return toast.custom((id) => (
      <div onClick={() => toast.dismiss(id)} style={{
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
        borderRadius: 12, padding: '10px 12px', minWidth: 220,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
      }}>
        <div style={{ width: 10, height: 10, borderRadius: 9999, background: accent }} />
        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{text}</div>
      </div>
    ), { duration: 4000 });
  }, []);

  // Allow reopening the collapsed prefetch toast from the minimized capsule
  const reopenPrefetchToast = useCallback((targetSite: Site) => {
    // Create a new toast for this site and record its id
    const id = toast.custom((tid) => (
      <CollapsiblePrefetchToast
        targetSite={targetSite}
        onCollapse={() => {
          setMinimizedPrefetchSites(prev => {
            const next = new Set(prev);
            next.add(targetSite);
            return next;
          });
          toast.dismiss(tid);
        }}
        onCancel={() => {
          cancelledPrefetchSitesRef.current.add(targetSite);
          // Close SSE if open
          const es = sseRefs.current.get(targetSite);
          if (es) { try { es.close(); } catch {} sseRefs.current.delete(targetSite); }
          // Dismiss any active toast for this site
          const existing = toastIdsRef.current.get(targetSite);
          if (existing !== undefined) toast.dismiss(existing);
          toast.dismiss(tid);
          toastIdsRef.current.delete(targetSite);
          // Remove from minimized when canceled
          setMinimizedPrefetchSites(prev => {
            if (!prev.size) return prev;
            const next = new Set(prev);
            next.delete(targetSite);
            return next;
          });
          quickToast('message', `Canceled tag download for ${targetSite}`);
        }}
      />
    ), { duration: Infinity });

    // Replace any stored id with the new one
    toastIdsRef.current.set(targetSite, id);

    // Hide the minimized capsule for this site while the full toast is open
    setMinimizedPrefetchSites(prev => {
      if (!prev.size) return prev;
      const next = new Set(prev);
      next.delete(targetSite);
      return next;
    });
  }, [setMinimizedPrefetchSites, quickToast]);

  const startTagPrefetch = useCallback(async (targetSite: Site) => {
    if (!isSupportedForTagPrefetch(targetSite)) return;

    // prevent parallel duplicate prefetches and duplicate toasts per site
    if (prefetchingSitesRef.current.has(targetSite)) return;
    prefetchingSitesRef.current.add(targetSite);

    try {
      // Check current status first
      const statusRes = await fetch(`/api/tags/status?site=${encodeURIComponent(targetSite)}`);
      const status = await statusRes.json();
      try {
        const initBytes = (status?.downloadedBytes as number) || 0;
        setProgressPerSite(prev => { const next = new Map(prev); next.set(targetSite, initBytes); return next; });
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tag-progress', { detail: { site: targetSite, bytes: initBytes } }));
      } catch {}


      // If already fresh and has cache, no need to show long toast
      if (status && status.fresh && status.hasCache && status.size > 0) {
        quickToast('success', `${targetSite} tags are up to date (${status.size.toLocaleString()} tags)`);
        return;
      }

      // Create or reuse a collapsible indeterminate progress toast
      let id = toastIdsRef.current.get(targetSite);
      if (id === undefined) {
        id = toast.custom((tid) => (
          <CollapsiblePrefetchToast
            targetSite={targetSite}
            onCollapse={() => {
              setMinimizedPrefetchSites(prev => {
                const next = new Set(prev);
                next.add(targetSite);
                return next;
              });
              toast.dismiss(tid);
            }}
            onCancel={() => {
              cancelledPrefetchSitesRef.current.add(targetSite);
              // Close SSE if open
              const es = sseRefs.current.get(targetSite);
              if (es) { try { es.close(); } catch {} sseRefs.current.delete(targetSite); }
              toast.dismiss(tid);
              const id2 = toastIdsRef.current.get(targetSite);
              if (id2 !== undefined) toast.dismiss(id2);
              toastIdsRef.current.delete(targetSite);
              quickToast('message', `Canceled tag download for ${targetSite}`);
            }}
          />
        ), { duration: Infinity });
        toastIdsRef.current.set(targetSite, id);
      }

      // Kick off background refresh only if not already in progress
      if (!status?.inProgress) {
        await fetch('/api/tags/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site: targetSite })
        });
      }

      // Start SSE status stream for live progress
      if (!sseRefs.current.get(targetSite)) {
        const es = new EventSource(`/api/tags/status?site=${encodeURIComponent(targetSite)}&stream=1`);
        sseRefs.current.set(targetSite, es);

        const handleProgress = (data: any) => {
          const bytes = (data?.downloadedBytes as number) || 0;
          setProgressPerSite(prev => {
            const next = new Map(prev);
            next.set(targetSite, bytes);
            return next;
          });
          if (typeof window !== 'undefined') {
            try { window.dispatchEvent(new CustomEvent('tag-progress', { detail: { site: targetSite, bytes } })); } catch {}
          }
          // Cancel path honored
          if (cancelledPrefetchSitesRef.current.has(targetSite)) {
            try { es.close(); } catch {}
            sseRefs.current.delete(targetSite);
            return;
          }
          if (data && data.inProgress === false) {
            // Dismiss any active toast for this site (including a reopened one)
            const latestId = toastIdsRef.current.get(targetSite);
            if (latestId !== undefined) {
              try { toast.dismiss(latestId); } catch {}
            }
            toastIdsRef.current.delete(targetSite);
            // Remove minimized capsule
            setMinimizedPrefetchSites(prev => {
              if (!prev.size) return prev;
              const next = new Set(prev);
              next.delete(targetSite);
              return next;
            });
            try { es.close(); } catch {}
            sseRefs.current.delete(targetSite);
          }
        };

        es.addEventListener('status', (evt: any) => {
          try { handleProgress(JSON.parse(evt.data)); } catch {}
        });
        es.addEventListener('progress', (evt: any) => {
          try { handleProgress(JSON.parse(evt.data)); } catch {}
        });
        es.addEventListener('error', () => {
          // ignore; browser will try to reconnect automatically
        });
      }
    } catch (e) {
      console.error('Prefetch failed', e);
      const id = toastIdsRef.current.get(targetSite);
      if (id !== undefined) toast.dismiss(id);
      toastIdsRef.current.delete(targetSite);
      setMinimizedPrefetchSites(prev => {
        if (!prev.size) return prev;
        const next = new Set(prev);
        next.delete(targetSite);
        return next;
      });
      quickToast('error', 'Failed to prefetch tags');
    } finally {
      prefetchingSitesRef.current.delete(targetSite);
    }
  }, [quickToast]);

  // size labels moved to shared constants helper

  const getConsentServer = useCallback(async (targetSite: Site): Promise<'accepted' | 'declined' | null> => {
    try {
      const res = await fetch(`/api/consent?site=${encodeURIComponent(targetSite)}`);
      const data = await res.json();
      return (data?.consent as 'accepted' | 'declined' | null) ?? null;
    } catch {
      return null;
    }
  }, []);

  const setConsentServer = useCallback(async (targetSite: Site, value: 'accepted' | 'declined'): Promise<void> => {
    try {
      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: targetSite, value }),
      });
    } catch {}
  }, []);

  const maybePromptOrAutoPrefetch = useCallback(async (targetSite: Site) => {
    if (!isSupportedForTagPrefetch(targetSite)) return;
    const c = await getConsentServer(targetSite);
    if (c === 'accepted') {
      startTagPrefetch(targetSite);
      return;
    }
    if (c === null) {
      setTagPromptSite(targetSite);
    }
  }, [startTagPrefetch, getConsentServer]);

  const handleSearch = (tags: string, navigate: boolean = true) => {
    // Only reset if the tags have actually changed
    if (tags !== searchTags) {
      setSearchTags(tags);
      setPosts([]);
      setPage(1);
      setHasMore(true);
      setError(null);
      if (navigate) {
        try { setUrl(buildPath(site, tags, 1), 'push'); } catch {}
      }
    } else {
      if (navigate) {
        try { setUrl(buildPath(site, tags, 1), 'push'); } catch {}
      }
    }
  };

  const handleSiteChange = useCallback((newSite: Site) => { 
    // Determine tags to use for the new site
    const currentTags = searchTags.trim();
    const isOnlyRating = currentTags === 'rating:safe' || 
                         currentTags === 'rating:general' || 
                         currentTags === '';
    const newTags = isOnlyRating ? (DEFAULT_RATING_BY_SITE[newSite] ?? '') : searchTags;

    // Update state
    setSite(newSite);
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    if (isOnlyRating) setSearchTags(newTags);

    // Prompt or auto-prefetch based on prior consent
    maybePromptOrAutoPrefetch(newSite);

    // Navigate to the new URL
    try { setUrl(buildPath(newSite, newTags, 1), 'push'); } catch {}
  }, [searchTags, setUrl, buildPath, maybePromptOrAutoPrefetch]);

  const handleSiteSwitch = useCallback((num: number) => {
    const sites: Site[] = ['yande.re', 'konachan.com', 'gelbooru.com', 'rule34.xxx', 'e621.net'];
    if (num >= 1 && num <= sites.length) {
      handleSiteChange(sites[num - 1]);
    }
  }, [handleSiteChange]);

  // Setup global keyboard shortcuts
  useKeyboardShortcuts([
    // Gallery navigation
    { key: 'ArrowLeft', handler: () => handleGalleryNavigation('left'), enabled: !selectedPost },
    { key: 'ArrowRight', handler: () => handleGalleryNavigation('right'), enabled: !selectedPost },
    { key: 'ArrowUp', handler: () => handleGalleryNavigation('up'), enabled: !selectedPost },
    { key: 'ArrowDown', handler: () => handleGalleryNavigation('down'), enabled: !selectedPost },
    { key: 'Enter', handler: handleOpenSelected, enabled: !selectedPost && selectedIndex >= 0 },
    { key: 'Home', handler: () => {
      setSelectedIndex(0);
      // Scroll to top when Home is pressed
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }, enabled: !selectedPost && posts.length > 0 },
    { key: 'End', handler: () => {
      setSelectedIndex(posts.length - 1);
      // Force scroll to the last image
      requestAnimationFrame(() => {
        const lastElement = document.querySelector(`[data-index="${posts.length - 1}"]`);
        if (lastElement) {
          lastElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center'
          });
        }
      });
    }, enabled: !selectedPost && posts.length > 0 },
    { key: 'PageUp', handler: () => handlePageChange(Math.max(1, page - 1)), enabled: !selectedPost && page > 1 },
    { key: 'PageDown', handler: () => handlePageChange(page + 1), enabled: !selectedPost && hasMore },
    
    // Global shortcuts
    { key: '/', handler: handleFocusSearch, preventDefault: true },
    { key: 'h', handler: handleToggleHeader },
    { key: '?', shift: true, handler: () => setShowShortcuts(true) },
    
    // Site switching
    { key: '1', handler: () => handleSiteSwitch(1) },
    { key: '2', handler: () => handleSiteSwitch(2) },
    { key: '3', handler: () => handleSiteSwitch(3) },
    { key: '4', handler: () => handleSiteSwitch(4) },
    { key: '5', handler: () => handleSiteSwitch(5) },
  ]);



  const handleImageTypeChange = (newImageType: 'preview' | 'sample') => {
    setImageType(newImageType);
  };

  const handleLimitChange = (newLimit: number) => {
    const clamped = Math.max(1, Math.floor(newLimit));
    setLimit(clamped);
    // Reset to page 1 and reload
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    loadPosts(1, true);
  };

  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
  };

  const handleE621AuthChange = (login: string, key: string) => {
    setE621Login(login);
    setE621ApiKey(key);
  };

  const handleRetry = () => {
    setError(null);
    setHasMore(true);
    if (posts.length === 0) {
      loadPosts(1, true);
    } else {
      loadPosts(page);
    }
  };

  // When blocklist changes, refresh results from page 1
  useEffect(() => {
    // avoid refetch before initial apiRef is ready - but safe to call
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    loadPosts(1, true);
  }, [blocklist, loadPosts]);

  return (
    <div className="app-container">
      {/* Keyboard shortcuts hint - compact button */}
      {!showShortcuts && !selectedPost && (
        <button
          className="keyboard-hint-compact"
          onClick={() => setShowShortcuts(true)}
          title="Keyboard shortcuts (Press ?)"
          aria-label="View keyboard shortcuts"
        >
          <span>?</span>
        </button>
      )}

      {/* Minimized tag-prep spinners: clickable overlay in top-right to reopen the toast */}
      {minimizedPrefetchSites.size > 0 && (
        <div
          style={{
            position: 'fixed',
            // On mobile, dock bottom-right; otherwise top-right
            top: isMobile ? undefined : 16,
            bottom: isMobile ? 16 : undefined,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'auto',
            zIndex: 9999,
          }}
        >
          {Array.from(minimizedPrefetchSites).map((s) => (
            <div
              key={s}
              onClick={() => reopenPrefetchToast(s as Site)}
              title={`Show tag download for ${s}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 9999,
                padding: '6px 10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                cursor: 'pointer',
              }}
              role="button"
              aria-label={`Show tag download for ${s}`}
            >
              <span style={{
                display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                border: '2px solid var(--bg-tertiary)', borderTopColor: 'var(--accent)',
                animation: 'spin 0.9s linear infinite'
              }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{s} • {formatBytes((progressPerSite.get(s as Site) || 0))}</span>
            </div>
          ))}
        </div>
      )}
      <button 
        className={`header-toggle ${headerHidden ? 'floating' : ''}`}
        onClick={() => setHeaderHidden(!headerHidden)}
        aria-label={headerHidden ? 'Show header' : 'Hide header'}
      >
        {headerHidden ? '☰' : '✕'}
      </button>
      
      <header className={`app-header ${headerHidden ? 'hidden' : ''}`}>
        <div className="header-content">
          <h1 className="app-title">uwuviewer</h1>
        </div>
        
        <SearchBar
          onSearch={handleSearch}
          onSiteChange={handleSiteChange}
          onPageChange={handlePageChange}
          onImageTypeChange={handleImageTypeChange}
          onApiKeyChange={handleApiKeyChange}
          onE621AuthChange={handleE621AuthChange}
          onLimitChange={handleLimitChange}
          currentSite={site}
          currentPage={page}
          currentImageType={imageType}
          currentApiKey={apiKey}
          currentE621Login={e621Login}
          currentE621ApiKey={e621ApiKey}
          currentLimit={limit}
          hasMore={hasMore}
          loading={loading}
          searchTags={searchTags}
        />
      </header>

      <main className="app-main">
        {error && (
          <div className="error-container">
            <div className="error-message">
              <p>Error: {error}</p>
              <button onClick={handleRetry} className="retry-button">
                Try Again
              </button>
            </div>
          </div>
        )}

        <div className="gallery-masonry" ref={galleryRef}>
          {columns.map((col, cIdx) => (
            <div className="masonry-col" key={cIdx}>
              {col.map((post, pIdx) => {
                // Find the actual index of this post in the original posts array
                const actualIndex = posts.findIndex(p => p.id === post.id);
                return (
                  <div
                    key={post.id}
                    className={`image-card-wrapper ${selectedIndex === actualIndex ? 'selected' : ''}`}
                    data-index={actualIndex}
                  >
                    <ImageCard
                      post={post}
                      site={site}
                      imageType={imageType}
                      onClick={() => { 
                        if (typeof window !== 'undefined') { 
                          prevPathRef.current = getPathname(); 
                          try { setUrl(`/${site}/posts/${post.id}`, 'push'); } catch {} 
                        } 
                        setSelectedPost(post);
                        setSelectedIndex(actualIndex);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {loading && (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading images...</p>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="end-message">
            <p>No more images to load</p>
          </div>
        )}

        {!loading && posts.length === 0 && !error && !isInitialLoad && (
          <div className="empty-message">
            <p>No images found</p>
          </div>
        )}
      </main>

       <ImageViewer
         post={selectedPost}
         site={site}
         apiKey={apiKey}
         onClose={() => {
           if (pendingNavRef.current?.type === 'search') {
             const nav = pendingNavRef.current;
             pendingNavRef.current = null;
              try { setUrl(buildPath(site, nav.tags, 1), 'replace'); } catch {}           } else {
              try { setUrl(prevPathRef.current || buildPath(site, searchTags, page), 'replace'); } catch {}           }
           setSelectedPost(null);
           setSelectedIndex(-1);
         }}
         onTagClick={(tag) => {
           // queue navigation to search after viewer closes, but update state immediately
           pendingNavRef.current = { type: 'search', tags: tag };
           handleSearch(tag, false);
         }}
         onNavigate={(direction) => {
           const currentIdx = posts.findIndex(p => p.id === selectedPost?.id);
           if (currentIdx === -1) return;
           
           const newIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
           if (newIdx >= 0 && newIdx < posts.length) {
             const newPost = posts[newIdx];
             setSelectedPost(newPost);
             setSelectedIndex(newIdx);
             try { setUrl(`/${site}/posts/${newPost.id}`, 'replace'); } catch {}
           }
         }}
         hasPrevious={selectedPost ? posts.findIndex(p => p.id === selectedPost.id) > 0 : false}
         hasNext={selectedPost ? posts.findIndex(p => p.id === selectedPost.id) < posts.length - 1 : false}
       />

       <KeyboardShortcutsModal 
         isOpen={showShortcuts} 
         onClose={() => setShowShortcuts(false)} 
       />

       {tagPromptSite && typeof document !== 'undefined' && ReactDOM.createPortal(
         <div className="modal-overlay" onClick={() => setTagPromptSite(null)}>
           <div className="modal-content" onClick={(e) => e.stopPropagation()}>
             <h3>Download tags for {tagPromptSite}?</h3>
             <p className="modal-description">
               To enable fast, offline tag autocomplete and colored tag info, we can download the full tag list for {tagPromptSite}. The average download size is {getTagDownloadSizeLabel(tagPromptSite)}.
             </p>
             <div className="modal-buttons">
               <button
                 className="modal-button save"
                 onClick={() => {
                   const s = tagPromptSite as Site;
                    setConsentServer(s, 'accepted');
                    setTagPromptSite(null);
                    startTagPrefetch(s);                 }}
               >
                 Download tags
               </button>
               <button
                 className="modal-button cancel"
                 onClick={() => {
                   const s = tagPromptSite as Site;
                    setConsentServer(s, 'declined');
                    setTagPromptSite(null);                 }}
               >
                 Not now
               </button>
             </div>
           </div>
         </div>,
         document.body
       )}
 
       <style jsx>{`
        .app-container {
          min-height: 100vh;
          background: var(--bg-primary);
        }

        .header-toggle {
          position: fixed;
          top: 16px;
          left: 16px;
          z-index: 101;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .header-toggle:hover {
          background: var(--bg-tertiary);
          transform: scale(1.05);
        }

        .header-toggle.floating {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .header-toggle.floating:hover {
          background: var(--accent-hover);
        }

        .app-header {
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
          padding: 24px 24px;
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(10px);
          background: rgba(36, 36, 36, 0.95);
          transition: transform 0.3s ease, opacity 0.3s ease;
        }

        .app-header.hidden {
          transform: translateY(-100%);
          opacity: 0;
          pointer-events: none;
        }

        .header-content {
          text-align: center;
          margin-bottom: 16px;
        }

        .app-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
          letter-spacing: -0.5px;
        }

        .app-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .app-main {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .gallery-masonry {
          display: flex;
          gap: 16px;
          margin-bottom: 48px;
        }
        .masonry-col {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        
        @media (max-width: 768px) {
          .gallery-masonry {
            gap: 12px;
          }
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          color: var(--text-secondary);
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid var(--bg-tertiary);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-container {
          display: flex;
          justify-content: center;
          padding: 48px;
        }

        .error-message {
          text-align: center;
          color: #ff6b6b;
        }

        .error-message p {
          margin-bottom: 16px;
        }

        .retry-button {
          padding: 10px 24px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .retry-button:hover {
          background: var(--accent-hover);
        }

        .empty-message,
        .end-message {
          text-align: center;
          padding: 48px;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .app-header {
            padding: 24px 16px;
          }

          .app-main {
            padding: 16px;
          }


        }

        /* Modal styles (shared look with other modals) */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 24px;
          max-width: 520px;
          width: 90%;
        }
        .modal-content h3 {
          margin: 0 0 12px 0;
          color: var(--text-primary);
          font-size: 18px;
        }
        .modal-description {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 16px;
        }
        .modal-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .modal-button {
          padding: 8px 16px;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .modal-button.save {
          background: var(--accent);
          color: white;
        }
        .modal-button.save:hover {
          background: var(--accent-hover);
        }
        .modal-button.cancel {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }
        .modal-button.cancel:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .image-card-wrapper {
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: center;
        }

        .image-card-wrapper.selected {
          transform: scale(1.05) translateZ(0);
          z-index: 10;
        }

        .image-card-wrapper.selected::before {
          content: '';
          position: absolute;
          inset: -4px;
          border: 3px solid var(--accent);
          border-radius: calc(var(--radius-sm) + 4px);
          pointer-events: none;
          z-index: 1;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .image-card-wrapper.selected::after {
          content: '';
          position: absolute;
          inset: -8px;
          background: radial-gradient(circle at center, var(--accent), transparent);
          opacity: 0.2;
          border-radius: calc(var(--radius-sm) + 8px);
          pointer-events: none;
          z-index: -1;
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.02);
          }
        }

        @keyframes glow {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 0.3;
          }
        }

        .keyboard-hint-compact {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: 50%;
          color: var(--text-secondary);
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 50;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
          animation: slideInRight 0.5s ease-out, subtlePulse 3s ease-in-out 1s 2;
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes subtlePulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }

        .keyboard-hint-compact:hover {
          transform: translateY(-2px) scale(1.05);
          background: var(--accent);
          color: white;
          border-color: var(--accent);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }

        .keyboard-hint-compact:active {
          transform: translateY(0) scale(0.98);
        }

        .keyboard-hint-compact span {
          font-family: var(--font-mono, monospace);
          line-height: 1;
        }

        @media (max-width: 768px) {
          .keyboard-hint-compact {
            bottom: 80px;
            right: 16px;
            width: 38px;
            height: 38px;
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}
