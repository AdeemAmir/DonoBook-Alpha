// geminiScanner.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const scanBookImage = async (base64Image: string, mimeType: string) => {
    // Remove the apiVersion override — the SDK defaults to v1beta which supports this model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `
        Analyze this book cover image. 
        Return a strictly valid JSON object with these keys:
        {
          "title": "Full book title in English. If the title is in Urdu or Sindhi, romanize it (e.g. 'Urdu Lazmi'). Never use original script.",
          "grade": "Specific class as 'Class 1' through 'Class 12', or write 'None' if not found. Never use roman numerals.",
          "category": "Determine carefully: Use 'Textbook' ONLY for official school/curriculum books for specific grades. Use 'Story book' for fiction, novels, or children's stories. Use 'Other book' for religious books, philosphy books, journals, guides, or general non-fiction.",
          "condition": "New, Used - Like New, Used - Fair, or Worn",
          "description": "Two-sentence summary"
        }
        IMPORTANT: Return ONLY the JSON object. No markdown, no conversational text.
    `;

    try {
        const result = await model.generateContent([
            { text: prompt },
            { inlineData: { data: base64Image, mimeType: mimeType } }
        ]);

        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Invalid AI response format");
        }

        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("Gemini Scan Error Details:", error);
        throw error;
    }
};