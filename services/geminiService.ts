import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string;
  aspectRatio: AspectRatio;
  count?: 1 | 4;
  mode?: 'creative' | 'styles'; // הוספנו פרמטר לבחירת המצב
}

/**
 * אסטרטגיה 1: Creative Director (הקיים)
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
Context: ${isEditing ? "User is editing an uploaded image." : "User is generating a new image from scratch."}

TASK: Generate ${count} distinct prompts based on the User Input.
CRITICAL REQUIREMENT: Output ONLY the prompts as a valid JSON array of strings.
Example output: ["prompt 1", "prompt 2"]`
        }]
      }]
    });

    const text = response.text ? response.text() : ""; 
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const prompts = JSON.parse(cleanedText);
    return Array.isArray(prompts) ? prompts.slice(0, count) : Array(count).fill(basePrompt);
  } catch (e) {
    console.warn("Creative prompt generation failed", e);
    return Array(count).fill(basePrompt);
  }
}

/**
 * אסטרטגיה 2: Style Master (החדש - לפי ההוראות שלך)
 * יוצר 4 סגנונות ספציפיים: Realistic, Watercolor, Cyberpunk, Sketch
 */
async function generateStylePrompts(ai: GoogleGenAI, basePrompt: string): Promise<string[]> {
  // לפי ההוראה: Internally create 4 distinct prompts with different styles
  const styles = ["Realistic", "Watercolor", "Cyberpunk", "Sketch"];
  
  // אנחנו מבקשים מג'מיני לנסח את הפרומפט עבור כל סגנון
  const promptPromises = styles.map(async (style) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [{
            text: `Convert this subject into a prompt for a ${style} style image.
Subject: "${basePrompt}"
Output ONLY the prompt text.`
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
    // בחירת האסטרטגיה לפי המצב שנבחר בטאבים
    if (mode === 'styles' && count === 4) {
      // הפעלת הלוגיקה החדשה (4 סגנונות קבועים)
      prompts = await generateStylePrompts(ai, prompt);
    } else {
      // הפעלת הלוגיקה הרגילה (Creative Director)
      prompts = await generateCreativePrompts(ai, prompt, count, !!baseImageBase64);
    }

    // יצירת התמונות (Call image generation tool SEPARATE TIMES)
    const validImages = prompts.map(p => {
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1080&height=1920&nologo=true`;
    });

    let resultText = "Here is your wallpaper.";
    if (count > 1) {
      resultText = mode === 'styles' 
        ? "I've generated 4 distinct styles: Realistic, Watercolor, Cyberpunk, and Sketch."
        : `I've created ${validImages.length} variations based on your request.`;
    }

    return { images: validImages, text: resultText };

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
