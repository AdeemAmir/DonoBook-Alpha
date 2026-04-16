/**
 * Content Filter Utility
 * Client-side content moderation for user submissions
 * Prevents inappropriate content in book titles, descriptions, messages, etc.
 */

const BAD_WORDS: string[] = [
  // English profanity & slurs (abbreviated to avoid storing full list)
  "fuck", "shit", "ass", "bitch", "cunt", "dick", "cock", "pussy", "bastard",
  "damn", "hell", "piss", "crap", "whore", "slut", "faggot", "nigger",
  "asshole", "motherfucker", "bullshit", "wanker", "twat",
  // Urdu/Roman Urdu common profanity (romanized)
  "gandu", "madarchod", "behenchod", "benchod", "bhenchod", "chutiya",
  "chutia", "choot", "lund", "lawda", "randi", "harami", "maderchod",
  "gaand", "haramzada", "kutti", "kutta", "sali", "sala",
  // Hateful / targeted terms
  "terrorist", "extremist",
];

const SUSPICIOUS_PATTERNS = [
  // Phone numbers (to prevent direct contact bypass)
  /\b0[0-9]{10}\b/,
  /\+92[0-9]{10}\b/,
  // URLs in descriptions (could be spam/phishing)
  /https?:\/\//gi,
  /www\.[a-z0-9]+\.[a-z]{2,}/gi,
  // Email addresses in descriptions
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
];

/**
 * Normalizes text for comparison (lowercase, remove extra spaces, common substitutions)
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9]/g, (c) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s" }[c] || c))
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if text contains profanity or bad words
 */
export function containsBadWords(text: string): boolean {
  // if (!text) return false;
  // const normalized = normalize(text);
  // const words = normalized.split(/\s+/);
  // return BAD_WORDS.some((bad) => {
  //   return words.some((word) => word === bad) || normalized.includes(bad);
  // });
  if (!text) return false;
  const normalized = normalize(text);
  const words = normalized.split(/\s+/);
  return BAD_WORDS.some((bad) => words.includes(bad));
}

/**
 * Check for suspicious patterns (spam, contact info bypass)
 */
export function containsSuspiciousContent(text: string): { found: boolean; reason?: string } {
  if (!text) return { found: false };
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(text)) {
      if (/https?:\/\//gi.test(text) || /www\.[a-z0-9]+\.[a-z]{2,}/gi.test(text)) {
        return { found: true, reason: "URLs are not allowed in listings" };
      }
      if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g.test(text)) {
        return { found: true, reason: "Email addresses are not allowed in listings" };
      }
      return { found: true, reason: "Content contains restricted information" };
    }
  }
  return { found: false };
}

/**
 * Sanitize text to prevent XSS
 */
export function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

/**
 * Validate listing title - returns error message or null
 */
export function validateTitle(title: string): string | null {
  if (!title || title.trim().length < 2) return "Title is too short";
  if (title.trim().length > 150) return "Title is too long (max 150 characters)";
  if (containsBadWords(title)) return "Title contains inappropriate language";
  const suspicious = containsSuspiciousContent(title);
  if (suspicious.found) return suspicious.reason || "Title contains invalid content";
  return null;
}

/**
 * Validate description - returns error message or null
 */
export function validateDescription(description: string): string | null {
  if (!description) return null; // Description is optional
  if (description.length > 1000) return "Description is too long (max 1000 characters)";
  if (containsBadWords(description)) return "Description contains inappropriate language";
  const suspicious = containsSuspiciousContent(description);
  if (suspicious.found) return suspicious.reason || "Description contains invalid content";
  return null;
}

/**
 * Validate chat message - returns error message or null
 */
export function validateMessage(message: string): string | null {
  if (!message || message.trim().length === 0) return "Message cannot be empty";
  if (message.length > 2000) return "Message is too long (max 2000 characters)";
  if (containsBadWords(message)) return "Please keep messages respectful and appropriate";
  return null;
}

/**
 * Full listing validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateBookListing(data: {
  title: string;
  description?: string;
  author?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const titleError = validateTitle(data.title);
  if (titleError) errors.title = titleError;

  if (data.description) {
    const descError = validateDescription(data.description);
    if (descError) errors.description = descError;
  }

  if (data.author && containsBadWords(data.author)) {
    errors.author = "Author name contains inappropriate content";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateItemListing(data: {
  name: string;
  description?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const nameError = validateTitle(data.name);
  if (nameError) errors.name = nameError;

  if (data.description) {
    const descError = validateDescription(data.description);
    if (descError) errors.description = descError;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
