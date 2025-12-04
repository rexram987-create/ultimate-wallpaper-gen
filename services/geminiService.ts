import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string;
  aspectRatio: AspectRatio;
  count?: number;
  mode?: 'creative' | 'styles';
}

function cleanAIResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * Creative Director - עם תרגום חכם מעברית לאנגלית
 */
async function generateCreativePrompts(ai: GoogleGenAI, basePrompt: string, count: number, isEditing: boolean): Promise<string[]> {
  const safePrompt = basePrompt.replace(/"/g, "'").replace(/\n/g, " ");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `ROLE: Expert Translator & Art Director.
INPUT: "${safePrompt}"

INSTRUCTIONS:
1. IDENTIFY LANGUAGE: If the INPUT is in Hebrew (or any non-English language), TRANSLATE it to English immediately.
2. ENHANCE: Create ${count} distinct artistic prompt(s) in English based on the translation.
3. OUTPUT: Valid JSON Array of strings.

CRITICAL: The Output MUST be in English. Do NOT output Hebrew characters.`
        }]
      }]
    });

    const text = response.text ? response.text() : ""; 
    const cleanedText = cleanAIResponse(text);
    
    try {
        const prompts = JSON.parse(cleanedText);
        if (Array.isArray(prompts) && prompts.length > 0) return prompts.slice(0, count);
    } catch (e) {}
    
    // אם ה-AI החזיר טקסט רגיל (שהוא לא JSON) והוא באנגלית - נשתמש בו
    if (cleanedText && !/[\u0590-\u05FF]/.test(cleanedText)) return [cleanedText];

    return ["Artistic masterpiece"];

  } catch (e) {
    return ["Artistic wallpaper"];
  }
}

/**
 * Style Master - 4 סגנונות יציבים עם תרגום
 */
async function generateStylePrompts(ai: GoogleGenAI, basePrompt: string): Promise<string[]> {
  const styles = ["Realistic", "Anime", "Cyberpunk", "Watercolor"];
  const safePrompt = basePrompt.replace(/"/g, "'").replace(/\n/g, " ");
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `ROLE: Expert Art Director.
INPUT: "${safePrompt}"

TASK:
1. First, TRANSLATE the INPUT to English if it is in Hebrew.
2. Then, create exactly 4 distinct English image prompts, one for each style:
   1. Realistic
   2. Anime
   3. Cyberpunk
   4. Watercolor

OUTPUT FORMAT: Return ONLY a JSON Array of 4 strings in English.`
        }]
      }]
    });

    const text = response.text ? response.text() : "";
    const cleanedText = cleanAIResponse(text);
    const prompts = JSON.parse(cleanedText);

    if (Array.isArray(prompts) && prompts.length >= 4) {
      return prompts.slice(0, 4);
    }
    throw new Error("Invalid format");

  } catch (e) {
    // Fallback בטוח באנגלית
    return styles.map(style => `${style} style artwork (high quality)`);
  }
}

export async function generateWallpaper({ prompt, baseImageBase64, aspectRatio, count = 1, mode = 'creative' }: GenerateImageParams): Promise<{ images: string[]; text: string }> {
  
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing API Key");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  let prompts: string[] = [];

  // הגדרת רזולוציה (16:9 למחשב או 9:16 לטלפון)
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
      prompts = await generateCreativePrompts(ai, prompt, count, !!baseImageBase64);
    }

    const validImages = prompts.map(p => {
        const randomSeed = Math.floor(Math.random() * 1000000);
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=${width}&height=${height}&nologo=true&seed=${randomSeed}`;
    });

    let resultText = count > 1 ? "Here are your variations." : "Here is your wallpaper.";
    if (mode === 'styles') resultText = `I've generated 4 distinct styles (Realistic, Anime, Cyberpunk, Watercolor).`;

    return { images: validImages, text: resultText };

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
