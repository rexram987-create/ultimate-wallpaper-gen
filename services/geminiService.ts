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
 * תיקון: מחקנו את הדילוג על תמונה אחת. עכשיו ה-AI עובד תמיד.
 */
async function generateCreativePrompts(ai: GoogleGenAI, basePrompt: string, count: number, isEditing: boolean): Promise<string[]> {
  // נמחק: if (count <= 1) return [basePrompt]; 
  // אנחנו רוצים שה-AI יעבוד תמיד כדי לתרגם ולשפר את הפרומפט!

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
Example output: ["prompt 1", "prompt 2"]`
        }]
      }]
    });

    const text = response.text ? response.text() : ""; 
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const prompts = JSON.parse(cleanedText);
        // אם ה-AI החזיר מערך תקין, נשתמש בו
        if (Array.isArray(prompts) && prompts.length > 0) {
            return prompts.slice(0, count);
        }
    } catch (e) {
        console.warn("JSON parse failed, falling back to raw text translation");
    }
    
    // אם ה-JSON נכשל, נחזיר את הטקסט הנקי (אולי ה-AI פשוט כתב את הפרומפט)
    return [cleanedText || basePrompt];

  } catch (e) {
    console.warn("Creative prompt generation failed", e);
    // במקרה חירום: מחזירים את הקלט המקורי
    return [basePrompt];
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
            text: `TASK: Convert the User Input into a detailed prompt for a ${style} style image.
User Input: "${basePrompt}"
INSTRUCTIONS:
1. Detect language. If Hebrew/non-English -> TRANSLATE to English.
2. Create a prompt in English for "${style}" style.
OUTPUT: English prompt text only.`
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
      // גם במצב Creative (תמונה אחת), אנחנו שולחים ל-AI כדי שיתרגם וישפר
      prompts = await generateCreativePrompts(ai, prompt, count, !!baseImageBase64);
    }

    // יצירת התמונות עם Pollinations
    const validImages = prompts.map(p => {
        // קידוד מלא של הפרומפט ל-URL
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
