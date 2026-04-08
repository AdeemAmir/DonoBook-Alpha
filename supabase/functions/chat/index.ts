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
              text: 'You are the BookShare Assistant, a helpful AI guide for the BookShare platform. Help users understand how to use the app, find books, donate or exchange textbooks, and navigate features. Be friendly, concise, and educational-focused.' 
            }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
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