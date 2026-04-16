/**
 * Slug utilities for URL generation and parsing
 * Format: {url-safe-title}-{8-char-id-prefix}
 * Example: "algebra-class-10-mrstgame"
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a UUID
 */
export function isUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

/**
 * Generate a URL-friendly slug from a title and ID
 * @param title - The book title or item name
 * @param id - The UUID
 */
export function generateSlug(title: string, id: string): string {
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const shortId = id.replace(/-/g, "").slice(0, 8);
  return `${safeTitle}-${shortId}`;
}

/**
 * Check if a param is a slug or UUID,
 * and return the appropriate Supabase filter
 */
export function getListingFilter(slugOrId: string): { column: "id" | "slug"; value: string } {
  if (isUUID(slugOrId)) {
    return { column: "id", value: slugOrId };
  }
  return { column: "slug", value: slugOrId };
}
