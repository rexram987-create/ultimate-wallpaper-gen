import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string;
  aspectRatio: AspectRatio;
  count?: number;
  mode?: 'creative' | 'styles';
}

/**
 * מנקה כוכביות וסימנים מיותרים שה-AI לפעמים מוסיף
 */
function cleanText(text: string): string {
  return text.replace(/\*/g, '').replace(/```/g, '').trim();
}

/**
 * המוח היצירתי (Creative)
 */
async function generateCreativePrompts(ai: GoogleGenAI, basePrompt: string, count: number): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `You are a professional translator and art director.
Step 1: Translate the following input to English (if it is Hebrew or another language).
Step 2: Create a detailed artistic image prompt based on the translation.

Input: "${basePrompt}"
Output: Just the English prompt text. Nothing else.`
        }]
      }]
    });

    const result = cleanText(response.text ? response.text() : "");
    // משכפלים את הפרומפט כמספר התמונות (הגיוון יבוא מה-Seed בהמשך)
    return Array(count).fill(result || "Artistic image");

  } catch (e) {
    return Array(count).fill("Artistic image");
  }
}

/**
 * המוח הסגנוני (Styles) - הגרסה היציבה של האריות
 */
async function generateStylePrompts(ai: GoogleGenAI, basePrompt: string): Promise<string[]> {
  // 4 הסגנונות שעבדו הכי טוב
  const styles = ["Realistic", "Anime", "Cyberpunk", "Watercolor"];
  
  // שולחים 4 בקשות נפרדות במקביל (הכי אמין לעברית)
  const promises = styles.map(async (style) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{
            text: `Task:
1. Translate the Input to English.
2. Write a short image prompt describing the subject in "${style}" style.

Input: "${basePrompt}"
Output: Only the English prompt.`
          }]
        }]
      });
      
      const text = cleanText(response.text ? response.text() : "");
      // אם הטקסט ריק, מחזירים גיבוי
      return text || `${style} style art of ${basePrompt}`;
      
    } catch (e) {
      // אם הייתה שגיאה, מחזירים גיבוי כדי שלא יהיה "חור" של תמונה חסרה
      return `${style} artwork`;
    }
  });

  return Promise.all(promises);
}

export async function generateWallpaper({ prompt, baseImageBase64, aspectRatio, count = 1, mode = 'creative' }: GenerateImageParams): Promise<{ images: string[]; text: string }> {
  
  // וידוא מפתח Vercel
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing API Key");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  let prompts: string[] = [];

  // הגדרת גודל תמונה (שמרתי לך את ה-16:9 כי זה עבד טוב)
  let width = 1080;
  let height = 1920;
  if (aspectRatio === '16:9') {
      width = 1920;
      height = 1080;
  }

  try {
    if (mode === 'styles') {
      prompts = await generateStylePrompts(ai, prompt);
    } else {
      prompts = await generateCreativePrompts(ai, prompt, count || 1);
    }

    // יצירת הקישורים עם מספר אקראי (Seed) כדי להבטיח שהתמונות יהיו שונות
    const validImages = prompts.map(p => {
        const randomSeed = Math.floor(Math.random() * 1000000);
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=${width}&height=${height}&nologo=true&seed=${randomSeed}`;
    });

    let resultText = "Here is your wallpaper.";
    if (mode === 'styles') {
       resultText = `Generated 4 styles: Realistic, Anime, Cyberpunk, Watercolor.`;
    }

    return { images: validImages, text: resultText };

  } catch (error) {
    console.error("Generative Error:", error);
    throw error;
  }
}
