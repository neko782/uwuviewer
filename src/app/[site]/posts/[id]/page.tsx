"use client";

import { useEffect, useMemo, useState } from 'react';
import ImageViewer from '@/components/ImageViewer';
import { ImageBoardAPI, UnifiedPost, Site } from '@/lib/api';
import Link from 'next/link';

export default function PostPage(props: any) {
  const params = (props?.params || {}) as { site?: string; id?: string };
  const siteParam = decodeURIComponent(params.site || '').trim();
  const idParam = decodeURIComponent(params.id || '').trim();

  const isValidSite = (s: string): s is Site => {
    return (
      s === 'yande.re' ||
      s === 'konachan.com' ||
      s === 'gelbooru.com' ||
      s === 'rule34.xxx' ||
      s === 'e621.net'
    );
  };

  const site: Site | null = isValidSite(siteParam) ? siteParam : null;
  const [post, setPost] = useState<UnifiedPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const api = useMemo(() => (site ? new ImageBoardAPI(site) : null), [site]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!api || !idParam) return;
      setLoading(true);
      setError(null);
      try {
        // Universal fetch: posts list with id:[ID]
        const posts = await api.getPosts({ limit: 1, tags: `id:${idParam}` });
        if (cancelled) return;
        if (posts && posts.length > 0) {
          setPost(posts[0]);
        } else {
          setError('Post not found');
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load post');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api, idParam]);

  const searchHref = site ? `/${site}` : `/`;

  // If invalid site or id, just link back to root search
  if (!site || !idParam) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>Invalid post URL</p>
          <Link href={searchHref} style={{ color: 'var(--accent)' }}>Go to search</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top-left "Go to search" button. Intentionally simple navigation. */}
      <a
        href={searchHref}
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 11000,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          textDecoration: 'none'
        }}
        title="Go to search"
        aria-label="Go to search"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Go to search</span>
      </a>

      {/* Loading and error states under the overlay */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ color: 'var(--text-secondary)' }}>Loading post…</div>
        </div>
      )}

      {!loading && error && (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 16 }}>Error: {error}</p>
            <a href={searchHref} style={{ color: 'var(--accent)' }}>Go to search</a>
          </div>
        </div>
      )}

      {/* Full screen viewer. Close navigates back to search. */}
      {!loading && !error && (
        <ImageViewer
          post={post}
          site={site}
          apiKey={''}
          onClose={() => { try { window.location.assign(searchHref); } catch { window.location.href = searchHref; } }}
          onTagClick={(tag) => { const href = `/${site}/search/${encodeURIComponent(tag)}`; try { window.location.assign(href); } catch { window.location.href = href; } }}
        />
      )}
    </div>
  );
}
