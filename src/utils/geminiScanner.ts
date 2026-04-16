import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export interface BookScanResult {
  title: string;
  grade: string;
  category: string;
  condition: string;
  description: string;
  author?: string;
  publisher?: string;
  language?: string;
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export const scanBookImage = async (base64Image: string, mimeType: string): Promise<BookScanResult> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    safetySettings: SAFETY_SETTINGS,
  });

  const prompt = `You are an expert book scanner for a Pakistani school book/item donation/exchange platform.
Analyze this book cover image carefully and extract structured information.

Return ONLY a valid JSON object with these exact keys:
{
  "title": "Full book title in English. If the title is in Urdu or Sindhi script, romanize it accurately (e.g., 'Urdu Lazmi', 'Sindhi Boli'). Never use original script characters.",
  "grade": "Specific class level as 'Class 1' through 'Class 12'. Write 'None' if not a school textbook or grade not visible. Never use roman numerals (e.g., NOT 'Class VI', use 'Class 6').",
  "category": "MUST be one of exactly: 'textbook' (official school/curriculum book for a specific grade), 'story_book' (fiction, novels, children's stories, literature), or 'other_book' (religious texts, philosophy, dictionaries, reference books, guides).",
  "condition": "MUST be one of exactly: 'new' (unused/pristine), 'like_new' (minimal use, like new), 'good' (normal wear, readable), 'fair' (visible wear, still usable), 'worn' (heavy wear, torn pages possible).",
  "description": "2-3 sentence summary describing the book's subject, content, and target audience.",
  "author": "Author name(s) if visible on cover, otherwise null.",
  "publisher": "Publisher or board name if visible (e.g., Punjab Textbook Board, Oxford), otherwise null.",
  "language": "Primary language of the book: 'Urdu', 'English', 'Sindhi', 'Pashto', or 'Other'."
}

CRITICAL RULES:
- Return ONLY the JSON object — NO markdown, NO explanation, NO extra text
- If you cannot read the title clearly, make your best guess
- Never return empty strings; use null for fields you cannot determine
- Category MUST be exactly 'textbook', 'story_book', or 'other_book'
- Condition MUST be exactly 'new', 'like_new', 'good', 'fair', or 'worn'`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data: base64Image, mimeType: mimeType } }
  ]);

  const response = await result.response;
  const text = response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI could not parse book details — please enter them manually");
  }

  const parsed = JSON.parse(jsonMatch[0]) as BookScanResult;

  const validCategories = ["textbook", "story_book", "other_book"];
  const validConditions = ["new", "like_new", "good", "fair", "worn", "used"];

  if (!validCategories.includes(parsed.category?.toLowerCase())) {
    parsed.category = "other_book";
  }
  if (!validConditions.includes(parsed.condition?.toLowerCase())) {
    parsed.condition = "good";
  }

  parsed.category = parsed.category.toLowerCase();
  parsed.condition = parsed.condition.toLowerCase();

  if (parsed.grade === "None" || parsed.grade === "none" || !parsed.grade) {
    parsed.grade = "";
  }

  if (parsed.title) {
    parsed.title = parsed.title.trim();
  }

  return parsed;
};

export const validateScanResult = (result: BookScanResult): BookScanResult => {
  const sanitize = (text?: string | null): string => {
    if (!text) return "";
    return text.replace(/<[^>]*>/g, "").trim().slice(0, 500);
  };

  return {
    title: sanitize(result.title).slice(0, 150),
    grade: sanitize(result.grade).slice(0, 20),
    category: result.category,
    condition: result.condition,
    description: sanitize(result.description).slice(0, 1000),
    author: result.author ? sanitize(result.author).slice(0, 100) : undefined,
    publisher: result.publisher ? sanitize(result.publisher).slice(0, 100) : undefined,
    language: result.language ? sanitize(result.language).slice(0, 30) : undefined,
  };
};