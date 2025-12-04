import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string;
  aspectRatio: AspectRatio;
  count?: 1 | 4;
  mode?: 'creative' | 'styles';
}

function cleanAIResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * פונקציה לבדיקה אם הטקסט מכיל עברית
 */
function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

async function generateCreativePrompts(ai: GoogleGenAI, basePrompt: string, count: number, isEditing: boolean): Promise<string[]> {
  // ניקוי הקלט ממרכאות שיכולות לשבור את הקוד
  const safePrompt = basePrompt.replace(/"/g, "'").replace(/\n/g, " ");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `ROLE: Professional Interpreter & Art Director.
INPUT: "${safePrompt}"

INSTRUCTIONS:
1. TRANSLATE: If the INPUT is in Hebrew (or not English), translate it to English immediately.
2. CREATE: Generate ${count} detailed artistic prompt(s) in English based on the translation.
3. FORMAT: Return ONLY a raw JSON Array of strings.

CRITICAL RULE: The Output MUST be in English. Do NOT output Hebrew characters.

Example Output: ["A cute fluffy cat in a magical forest"]`
        }]
      }]
    });

    const text = response.text ? response.text() : ""; 
    const cleanedText = cleanAIResponse(text);
    
    // ניסיון ראשון: פענוח JSON
    try {
        const prompts = JSON.parse(cleanedText);
        if (Array.isArray(prompts) && prompts.length > 0) {
            return prompts.slice(0, count);
        }
    } catch (e) {
        // התעלמות משגיאת JSON
    }
    
    // ניסיון שני: אם ה-JSON נכשל, נשתמש בטקסט עצמו (בתקווה שהוא באנגלית)
    if (cleanedText && !containsHebrew(cleanedText) && cleanedText.length > 2) {
        return [cleanedText];
    }
    
    // רשת ביטחון אחרונה: אם הכל נכשל, לעולם לא נחזיר את המקור בעברית!
    return ["Artistic masterpiece, high quality, 8k"];

  } catch (e) {
    console.error("Creative prompt failed", e);
    return ["Abstract artistic wallpaper"];
  }
}

async function generateStylePrompts(ai: GoogleGenAI, basePrompt: string): Promise<string[]> {
  const styles = ["Realistic", "Watercolor", "Cyberpunk", "Sketch"];
  const safePrompt = basePrompt.replace(/"/g, "'").replace(/\n/g, " ");
  
  const promptPromises = styles.map(async (style) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{
            text: `Translate input to English and write a short "${style}" style image prompt.
Input: "${safePrompt}"
Output: English text only. NO HEBREW.`
          }]
        }]
      });
      
      const result = response.text ? response.text() : "";
      const cleaned = cleanAIResponse(result);
      
      // אם חזרה עברית בטעות - נחזיר פולבק
      if (containsHebrew(cleaned)) {
         return `${style} artistic visualization`;
      }
      return cleaned || `${style} art`;

    } catch (e) {
      return `${style} style art`;
    }
  });

  return Promise.all(promptPromises);
}

export async function generateWallpaper({ prompt, baseImageBase64, aspectRatio, count = 1, mode = 'creative' }: GenerateImageParams): Promise<{ images: string[]; text: string }> {
  
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing API Key");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  let prompts: string[] = [];

  try {
    if (mode === 'styles' && count === 4) {
      prompts = await generateStylePrompts(ai, prompt);
    } else {
      prompts = await generateCreativePrompts(ai, prompt, count, !!baseImageBase64);
    }

    // יצירת התמונות
    const validImages = prompts.map(p => {
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1080&height=1920&nologo=true`;
    });

    let resultText = "Here is your wallpaper.";
    if (count > 1) {
      resultText = mode === 'styles' 
        ? "I've generated 4 distinct styles."
        : `I've created ${validImages.length} variations.`;
    }

    return { images: validImages, text: resultText };

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
