import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('VITE_GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured in Supabase Secrets');
    }

    // Convert standard chat messages to Gemini's specific "contents" format
    // Note: Gemini uses "model" instead of "assistant"
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          // This is where your specific instructions live
          systemInstruction: {
            parts: [{
              text: `You are the DonoBook Assistant — a friendly, knowledgeable AI guide for the DonoBook platform.

DonoBook is a Pakistani school book and item donation/exchange platform, primarily serving students and families in Karachi.

YOUR CAPABILITIES:
- Explain how DonoBook works (donate books, exchange items, find textbooks)
- Guide users through uploading listings (books & school items)
- Help users understand the AI book scanner feature
- Explain the messaging, handover, and review system
- Answer questions about book categories: textbooks (Class 1-12), story books, religious/reference books
- Answer questions about item categories: bags, stationery, pencil boxes, lunchboxes, water bottles
- Explain condition grades: New, Like New, Good, Fair, Worn
- Guide welfare organizations through the verification process

PLATFORM FEATURES TO EXPLAIN:
1. Uploading a book: Go to Upload > Select "Book" > Upload cover photo (AI auto-fills details) > Fill in grade, condition, type (donate/exchange) > Submit
2. Finding books: Browse Home page, use filters for grade/category/location, click a listing to contact the owner
3. Messaging: Click "Contact Owner" on any listing, messages are private and secure
4. AI Scanner: Upload your book cover and the AI reads the title, grade, category, and condition automatically
5. Verification: Welfare organizations must submit their NGO documents for admin approval before posting

TONE: Friendly, concise, bilingual (English + Roman Urdu when user uses Urdu). Always helpful and educational.

SAFETY: If a user asks something unrelated to DonoBook or education (e.g., violence, politics, adult content), politely redirect them: "I'm only able to help with DonoBook and educational questions. Anything I can help you with on DonoBook?"

Keep responses concise — 2-4 short paragraphs or bullet points max. Use **bold** for important terms.`
            }]
          },
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 600,
          }
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Gemini API Error:', data.error);
      throw new Error(data.error.message || 'Error from Gemini API');
    }

    // Extract the text content from Gemini's response structure
    const assistantText = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                         'I apologize, but I could not process that request.';

    return new Response(
      JSON.stringify({ message: assistantText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});