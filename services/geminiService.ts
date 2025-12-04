import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string;
  aspectRatio: AspectRatio;
  count?: 1 | 4;
}

/**
 * פונקציה ליצירת גיוון בתיאורים באמצעות Gemini 2.5 Flash
 */
async function generateDiversePrompts(ai: GoogleGenAI, basePrompt: string, count: number, isEditing: boolean): Promise<string[]> {
  if (count <= 1) return [basePrompt];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a Master Creative Director.
User Input: "${basePrompt}"
Context: ${isEditing ? "User is editing an uploaded image." : "User is generating a new image from scratch."}

TASK: Generate ${count} distinct prompts based on the User Input.
CRITICAL REQUIREMENT: Output ONLY the prompts as a valid JSON array of strings. No markdown.
Example output: ["prompt 1", "prompt 2"]`
            }
          ]
        }
      ]
    });

    const text = response.text ? response.text() : ""; 
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const prompts = JSON.parse(cleanedText);
        if (Array.isArray(prompts)) return prompts.slice(0, count);
    } catch (e) {
        console.warn("JSON parse failed, using fallback", e);
    }
    return Array(count).fill(basePrompt);

  } catch (e) {
    console.error("Error generating diverse prompts:", e);
    return Array(count).fill(basePrompt);
  }
}

export async function generateWallpaper({ prompt, baseImageBase64, aspectRatio, count = 1 }: GenerateImageParams): Promise<{ images: string[]; text: string }> {
  
  // --- תיקון קריטי ל-Vercel ---
  // אנחנו משתמשים ב-import.meta.env כדי לקרוא את המפתח
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
      throw new Error("Missing API Key: VITE_GEMINI_API_KEY is not defined in Vercel.");
  }

  // אתחול הספרייה החדשה
  const ai = new GoogleGenAI({ apiKey: apiKey });

  try {
    // שלב 1: יצירת תיאורים מגוונים עם ג'מיני
    const prompts = await generateDiversePrompts(ai, prompt, count, !!baseImageBase64);

    // שלב 2: יצירת התמונות בפועל
    // מכיוון שג'מיני הוא מודל טקסט, אנחנו שולחים את התיאור למחולל תמונות חיצוני כדי שתראה תוצאה.
    const validImages = prompts.map(p => {
        const encodedPrompt = encodeURIComponent(p);
        // שימוש בשירות Pollinations ליצירת תמונה אמיתית בזמן אמת
        return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&nologo=true`;
    });

    return {
      images: validImages,
      text: count > 1 ? `Created ${validImages.length} variations for: "${prompt}"` : "Here is your generated wallpaper."
    };

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
