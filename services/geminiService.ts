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
 * אסטרטגיה 1: Creative Director
 * הוספנו הוראה: לתרגם לאנגלית אם הקלט בעברית
 */
async function generateCreativePrompts(ai: GoogleGenAI, basePrompt: string, count: number, isEditing: boolean): Promise<string[]> {
  if (count <= 1) return [basePrompt];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{
          text: `You are a Master Creative Director.
User Input: "${basePrompt}"

CRITICAL INSTRUCTION: If the User Input is in Hebrew (or any non-English language), TRANSLATE it to English first.
Context: ${isEditing ? "User is editing an uploaded image." : "User is generating a new image from scratch."}

TASK: Generate ${count} distinct, highly detailed artistic prompts based on the translated User Input.
OUTPUT LANGUAGE: English ONLY.
CRITICAL REQUIREMENT: Output ONLY the prompts as a valid JSON array of strings.
Example output: ["A futuristic city at sunset", "A watercolor painting of a city"]`
        }]
      }]
    });

    const text = response.text ? response.text() : ""; 
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const prompts = JSON.parse(cleanedText);
        return Array.isArray(prompts) ? prompts.slice(0, count) : Array(count).fill(basePrompt);
    } catch (e) {
        return Array(count).fill(basePrompt);
    }

  } catch (e) {
    console.warn("Creative prompt generation failed", e);
    return Array(count).fill(basePrompt);
  }
}

/**
 * אסטרטגיה 2: Style Master
 * הוספנו הוראה: לתרגם לאנגלית לפני יצירת הסגנון
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
            text: `TASK: Convert the User Input into a detailed prompt for a ${style} style image.

User Input: "${basePrompt}"

INSTRUCTIONS:
1. Detect the language of the User Input.
2. If it is Hebrew (or not English), TRANSLATE the meaning to English.
3. Create a descriptive prompt in English that fits the "${style}" style.

OUTPUT: Provide ONLY the final English prompt text. No explanations.`
          }]
        }]
      });
      return response.text ? response.text() : `${style} style painting of ${basePrompt}`;
    } catch (e) {
      return `${style} style of ${basePrompt}`;
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
        // אנחנו מקודדים את הפרומפט (שעכשיו הוא באנגלית בטוחה) ל-URL
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1080&height=1920&nologo=true`;
    });

    let resultText = "Here is your wallpaper.";
    if (count > 1) {
      resultText = mode === 'styles' 
        ? "I've generated 4 distinct styles (Translated & Created): Realistic, Watercolor, Cyberpunk, and Sketch."
        : `I've created ${validImages.length} variations based on your request.`;
    }

    return { images: validImages, text: resultText };

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
