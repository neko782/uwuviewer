import { Site } from './api';

export type RatingKey = 's' | 'q' | 'e' | 'sensitive' | string;

export interface RatingInfo {
  label: string;
  color: string;
  bg: string;
}

export const SITE_CONFIG: Array<{ value: Site; label: string; icon: string; defaultRating: string; needsApiKey?: boolean }>= [
  { value: 'yande.re', label: 'Yande.re', icon: '/yandere.ico', defaultRating: 'rating:safe' },
  { value: 'konachan.com', label: 'Konachan', icon: '/konachan.ico', defaultRating: 'rating:safe' },
  { value: 'gelbooru.com', label: 'Gelbooru', icon: '/gelbooru.ico', defaultRating: 'rating:general', needsApiKey: true },
  { value: 'e621.net', label: 'e621', icon: '/e621.ico', defaultRating: 'rating:safe' },
  { value: 'rule34.xxx', label: 'Rule34', icon: '/rule34.ico', defaultRating: '' },
];

export const DEFAULT_RATING_BY_SITE: Record<Site, string> = SITE_CONFIG.reduce((acc, s) => {
  acc[s.value] = s.defaultRating;
  return acc;
}, {} as Record<Site, string>);

const MOEBOORU_RATINGS: Record<RatingKey, RatingInfo> = {
  s: { label: 'Safe', color: '#4ade80', bg: '#166534' },
  q: { label: 'Questionable', color: '#fbbf24', bg: '#713f12' },
  e: { label: 'Explicit', color: '#f87171', bg: '#7f1d1d' },
};

const GELBOORU_RATINGS: Record<RatingKey, RatingInfo> = {
  s: { label: 'General', color: '#4ade80', bg: '#166534' },
  sensitive: { label: 'Sensitive', color: '#60a5fa', bg: '#1e3a8a' },
  q: { label: 'Questionable', color: '#fbbf24', bg: '#713f12' },
  e: { label: 'Explicit', color: '#f87171', bg: '#7f1d1d' },
};

export function getRatingInfo(site: Site | undefined, rating: RatingKey): RatingInfo {
  if (site === 'gelbooru.com') {
    return GELBOORU_RATINGS[rating] || GELBOORU_RATINGS['s'];
  }
  return MOEBOORU_RATINGS[rating] || MOEBOORU_RATINGS['s'];
}

export function getRatingLabel(site: Site, rating: RatingKey): string {
  return getRatingInfo(site, rating).label;
}

export function isSupportedForTagPrefetch(site: Site): boolean {
  return site === 'yande.re' || site === 'konachan.com' || site === 'rule34.xxx' || site === 'e621.net';
}

export function getTagDownloadSizeLabel(site: Site): string {
  if (site === 'rule34.xxx') return 'about 100 MB';
  if (site === 'yande.re' || site === 'konachan.com') return 'about 10 MB';
  if (site === 'e621.net') return 'about 15 MB';
  return '';
}
