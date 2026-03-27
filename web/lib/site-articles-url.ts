/**
 * Build POST URL for article image upload from the same base as SITE_API_URL / publish_article.
 * Handles trailing slashes and avoids fragile string replace on "articles".
 */
export function resolveArticlesUploadImageUrl(siteApiArticlesUrl: string): string {
  const base = (siteApiArticlesUrl || "https://strattegys.com/api/articles").trim().replace(/\/+$/, "");
  if (base.endsWith("/upload-image")) return base;
  return `${base}/upload-image`;
}
