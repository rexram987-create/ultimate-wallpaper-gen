import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string;
  aspectRatio: AspectRatio;
  count?: number;
  mode?: 'creative' | 'styles';
}

// פונקציית ניקוי בסיסית (בדיוק כמו בגרסה שעבדה)
function cleanText(text: string): string {
  return text.replace(/\*/g, '').replace(/```/g, '').trim();
}

/**
 * המנוע של ה"אריות": 4 סגנונות קבועים, בקשות נפרדות.
 * זה מה שעבד לנו הכי טוב.
 */
async function generateStylePrompts(ai: GoogleGenAI, basePrompt: string): Promise<string[]> {
  // הרשימה המקורית שעבדה
  const styles = ["Realistic", "Anime", "Cyberpunk", "Watercolor"];
  
  // לולאה פשוטה ששולחת 4 בקשות במקביל
  const promises = styles.map(async (style) => {
    try {
      // הנחיה פשוטה וישירה: תרגם לאנגלית ותאר את הסגנון
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{
            text: `Translate input to English. Write a short image prompt for style: "${style}".
Input: "${basePrompt}"
Output: English prompt only.`
          }]
        }]
      });
      const text = cleanText(response.text ? response.text() : "");
      // אם הצליח - מחזיר את הטקסט. אם חזר ריק - מחזיר גיבוי.
      return text || `${style} art of ${basePrompt}`;
    } catch (e) {
      // במקרה של שגיאה - מחזיר גיבוי כדי שתמיד יהיו 4 תמונות
      return `${style} style artwork`;
    }
  });

  return Promise.all(promises);
}

// המנוע למצב הרגיל (תמונה אחת)
async function generateCreativePrompts(ai: GoogleGenAI, basePrompt: string, count: number): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `Translate to English and create image prompt. Input: "${basePrompt}"` }] }]
    });
    const result = cleanText(response.text ? response.text() : "") || "Artistic image";
    return Array(count).fill(result);
  } catch (e) { return Array(count).fill("Artistic image"); }
}

export async function generateWallpaper({ prompt, baseImageBase64, aspectRatio, count = 1, mode = 'creative' }: GenerateImageParams): Promise<{ images: string[]; text: string }> {
  
  // המפתח ל-Vercel (חובה)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing API Key");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  let prompts: string[] = [];

  // טיפול בגודל (16:9 או 9:16)
  let width = 1080;
  let height = 1920;
  if (aspectRatio === '16:9') {
      width = 1920;
      height = 1080;
  }

  try {
    // בחירה בין המצבים
    if (mode === 'styles') {
      prompts = await generateStylePrompts(ai, prompt);
    } else {
      prompts = await generateCreativePrompts(ai, prompt, count || 1);
    }

    // יצירת הקישורים
    const validImages = prompts.map(p => {
        const randomSeed = Math.floor(Math.random() * 1000000);
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=${width}&height=${height}&nologo=true&seed=${randomSeed}`;
    });

    let resultText = "Here is your wallpaper.";
    if (mode === 'styles') resultText = "Generated 4 styles: Realistic, Anime, Cyberpunk, Watercolor.";

    return { images: validImages, text: resultText };

  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
