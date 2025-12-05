import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string;
  aspectRatio: AspectRatio;
  count?: number;
  mode?: 'creative' | 'styles';
}

function cleanText(text: string): string {
  return text.replace(/\*/g, '').replace(/```/g, '').trim();
}

async function generateStylePrompts(ai: GoogleGenAI, basePrompt: string): Promise<string[]> {
  const styles = ["Realistic", "Anime", "Cyberpunk", "Watercolor"];
  
  const promises = styles.map(async (style) => {
    try {
      // השארתי את 2.5 לבקשתך
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
      return text || `${basePrompt}, ${style} style artwork`;
    } catch (e) {
      // התיקון הקריטי: גם בכישלון, נשתמש בטקסט שלך!
      console.log(`Error with style ${style}, using backup.`);
      return `${basePrompt}, ${style} style artwork`; 
    }
  });

  return Promise.all(promises);
}

async function generateCreativePrompts(ai: GoogleGenAI, basePrompt: string, count: number): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // השארתי את 2.5
      contents: [{ role: "user", parts: [{ text: `Translate to English and create image prompt. Input: "${basePrompt}"` }] }]
    });
    const result = cleanText(response.text ? response.text() : "") || basePrompt;
    return Array(count).fill(result);
  } catch (e) { 
      console.log("Error in creative mode, using backup.");
      return Array(count).fill(basePrompt); 
  }
}

export async function generateWallpaper({ prompt, baseImageBase64, aspectRatio, count = 1, mode = 'creative' }: GenerateImageParams): Promise<{ images: string[]; text: string }> {
  
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing API Key");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  let prompts: string[] = [];

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
