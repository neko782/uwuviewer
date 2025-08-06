export function proxyImageUrl(url: string | undefined): string {
  if (!url) return '';
  return `/api/image?url=${encodeURIComponent(url)}`;
}