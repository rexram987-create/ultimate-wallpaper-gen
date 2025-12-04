import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string;
  aspectRatio: AspectRatio;
  count?: number; // שינינו ל-number כדי להיות גמישים (1 או 7)
  mode?: 'creative' | 'styles';
}

function cleanAIResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

async function generateCreativePrompts(ai: GoogleGenAI, basePrompt: string, count: number, isEditing: boolean): Promise<string[]> {
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
1. TRANSLATE: If INPUT is Hebrew/Non-English -> TRANSLATE to English.
2. ENHANCE: Create ${count} distinct artistic prompt(s) in English.
3. OUTPUT: Valid JSON Array of strings.
CRITICAL: Output English ONLY.`
        }]
      }]
    });

    const text = response.text ? response.text() : ""; 
    const cleanedText = cleanAIResponse(text);
    
    try {
        const prompts = JSON.parse(cleanedText);
        if (Array.isArray(prompts) && prompts.length > 0) return prompts.slice(0, count);
    } catch (e) {}
    
    if (cleanedText && !containsHebrew(cleanedText) && cleanedText.length > 2) return [cleanedText];
    return ["Artistic masterpiece 8k"];

  } catch (e) {
    return ["Abstract artistic wallpaper"];
  }
}

async function generateStylePrompts(ai: GoogleGenAI, basePrompt: string): Promise<string[]> {
  // הרשימה המעודכנת: 7 סגנונות כולל יפני
  const styles = ["Realistic", "Anime", "Cyberpunk", "Watercolor", "Oil Painting", "Sketch", "Japanese Art"];
  const safePrompt = basePrompt.replace(/"/g, "'").replace(/\n/g, " ");
  
  const promptPromises = styles.map(async (style) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{
            text: `Translate input to English and write a short "${style}" style prompt.
Input: "${safePrompt}"
Output: English text only.`
          }]
        }]
      });
      const result = cleanAIResponse(response.text ? response.text() : "");
      return containsHebrew(result) ? `${style} art` : result;
    } catch (e) {
      return `${style} art`;
    }
  });

  return Promise.all(promptPromises);
}

export async function generateWallpaper({ prompt, baseImageBase64, aspectRatio, count = 1, mode = 'creative' }: GenerateImageParams): Promise<{ images: string[]; text: string }> {
  
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing API Key");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  let prompts: string[] = [];

  // חישוב רזולוציה לפי הבחירה (נייד או מחשב)
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
    if (mode === 'styles') resultText = `I've generated ${validImages.length} distinct styles (including Japanese Art).`;

    return { images: validImages, text: resultText };

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
