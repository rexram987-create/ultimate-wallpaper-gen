import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string;
  aspectRatio: AspectRatio;
  count?: 1 | 4;
  mode?: 'creative' | 'styles';
}

/**
 * פונקציה שמנקה את הטקסט משאריות JSON לא רצויות
 */
function cleanAIResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * אסטרטגיה 1: Creative Director
 */
async function generateCreativePrompts(ai: GoogleGenAI, basePrompt: string, count: number, isEditing: boolean): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `You are a Master Creative Director.
User Input: "${basePrompt}"

TASK:
1. DETECT LANGUAGE: If User Input is Hebrew/Non-English -> TRANSLATE to English.
2. ENHANCE: Create ${count} detailed artistic prompt(s) based on the English translation.
3. OUTPUT: Valid JSON Array of strings.

Example for input "חתול": ["A majestic fluffy cat sitting on a throne, cinematic lighting"]
CRITICAL: Output English ONLY.`
        }]
      }]
    });

    const text = response.text ? response.text() : ""; 
    const cleanedText = cleanAIResponse(text);
    
    try {
        const prompts = JSON.parse(cleanedText);
        if (Array.isArray(prompts) && prompts.length > 0) {
            return prompts.slice(0, count);
        }
    } catch (e) {
        console.warn("JSON parse failed. Using raw text fallback.");
    }
    
    // --- התיקון הגדול ---
    // אם ה-JSON נכשל, אנחנו משתמשים בטקסט שה-AI החזיר (שהוא כבר באנגלית!)
    // במקום להחזיר את ה-basePrompt (שהוא בעברית).
    if (cleanedText && cleanedText.length > 2) {
        return [cleanedText];
    }
    
    // כמוצא אחרון בלבד (אם ה-AI לא החזיר כלום), נחזיר הנחיה גנרית באנגלית
    return ["Artistic wallpaper based on user request"];

  } catch (e) {
    console.error("Creative prompt generation failed", e);
    return ["Abstract artistic wallpaper"];
  }
}

/**
 * אסטרטגיה 2: Style Master
 */
async function generateStylePrompts(ai: GoogleGenAI, basePrompt: string): Promise<string[]> {
  const styles = ["Realistic", "Watercolor", "Cyberpunk", "Sketch"];
  
  const promptPromises = styles.map(async (style) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{
            text: `Translate user input to English (if needed) and write a prompt for a "${style}" style image.
User Input: "${basePrompt}"
Output: English prompt text only.`
          }]
        }]
      });
      const result = response.text ? response.text() : "";
      return cleanAIResponse(result) || `${style} art`;
    } catch (e) {
      return `${style} artistic visualization`;
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
        // אנחנו מקודדים את הפרומפט (שעכשיו הוא בטוח באנגלית)
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
