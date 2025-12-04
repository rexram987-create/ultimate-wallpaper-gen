import { GoogleGenAI } from "@google/generative-ai";
import { AspectRatio } from "../types";

interface GenerateImageParams {
  prompt: string;
  baseImageBase64?: string; // If editing an existing image
  aspectRatio: AspectRatio;
  count?: 1 | 4;
}

/**
 * Uses Gemini 2.5 Flash (Text) to expand a single prompt into 'count' distinct variations.
 */
async function generateDiversePrompts(ai: GoogleGenAI, basePrompt: string, count: number, isEditing: boolean): Promise<string[]> {
  // If only 1 image needed, no need for diversity expansion
  if (count <= 1) return [basePrompt];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        You are a Master Creative Director.
        User Input: "${basePrompt}"
        Context: ${isEditing ? "User is editing an uploaded image." : "User is generating a new image from scratch."}

        TASK: Generate ${count} distinct prompts based on the User Input.
        
        CRITICAL REQUIREMENT:
        For EACH variation, you must autonomously select a COMPLETELY DIFFERENT artistic style or medium. 
        Do NOT use a fixed list. Be unpredictable, creative, and random.
        
        Your goal is to surprise the user with 4 radically different visual interpretations of the same subject.

        Examples of stylistic directions (invent your own!):
        - Cinematographic Photography (e.g., Macro, Wide-angle, Noir lighting)
        - Classic Art (e.g., Baroque, Ukiyo-e, Impressionism, Charcoal Sketch)
        - Modern/Digital (e.g., Cyberpunk, Voxel Art, Low Poly, Vaporwave, Glitch Art)
        - Abstract/Conceptual (e.g., Surrealism, Paper Cutout, Stained Glass, Graffiti)
        - Materials (e.g., Made of cloud, Made of crystal, Knitted wool)

        INSTRUCTIONS:
        1. Keep the core subject/object from the user's prompt.
        2. Apply a unique, highly detailed style description to each.
        3. Ensure the prompt is in English (even if user input is Hebrew).

        OUTPUT:
        - Return ONLY a raw JSON array of ${count} strings.
        - Example: ["Prompt with Style A...", "Prompt with Style B...", "Prompt with Style C...", "Prompt with Style D..."]
      `,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return [basePrompt];
    
    const prompts = JSON.parse(text);
    if (Array.isArray(prompts) && prompts.length > 0) {
      return prompts.slice(0, count);
    }
    return [basePrompt];
  } catch (e) {
    console.error("Error generating diverse prompts:", e);
    // Fallback: just return the original prompt x times if the diversity generation fails
    return Array(count).fill(basePrompt);
  }
}

export async function generateWallpaper({ prompt, baseImageBase64, aspectRatio, count = 1 }: GenerateImageParams): Promise<{ images: string[]; text: string }> {
  // Initialize AI client inside the function to prevent top-level process.env issues
  const ai = new GoogleGenerativeAI({ apiKey:import.meta.env.VITE_GEMINI_API_KEY });

  // 1. Map Unsupported Aspect Ratios
  // The API only supports specific ratios. We map our custom "Full Mobile" (9:19.5) to "9:16".
  let apiAspectRatio = aspectRatio;
  if (aspectRatio === '9:19.5') {
    apiAspectRatio = '9:16';
  }

  try {
    // 2. Handle Diversity Logic (Text Model Step)
    // If count > 1, we first ask Gemini to brainstorm variations.
    const promptsToRun = await generateDiversePrompts(ai, prompt, count, !!baseImageBase64);

    // Define the strict safety prefix for mobile screens
    // We prepend this to ensure the model prioritizes layout before subject details
    const MOBILE_SAFETY_PREFIX = "Extreme vertical aspect ratio, massive side margins required. Create a narrow central composition occupying only the middle 50% of the width, leaving wide empty background space on both left and right sides. Subject: ";

    // 3. Execute Image Generations (Parallel)
    // We must make N separate API calls because "count" param in image tools often produces identical/similar results.
    const imagePromises = promptsToRun.map(async (p) => {
        const parts: any[] = [];

        // Add Image Reference if exists
        if (baseImageBase64) {
             // Extract base64 data (remove header if present)
            const base64Data = baseImageBase64.split(',')[1] || baseImageBase64;
            parts.push({
                inlineData: {
                    mimeType: "image/png", // Assuming PNG/JPEG, API is flexible
                    data: base64Data
                }
            });
        }

        // Apply Prompt Engineering for Mobile Ratios
        let finalPrompt = p;
        if (apiAspectRatio === '9:16') {
             // Prepend the strict layout instruction
             finalPrompt = MOBILE_SAFETY_PREFIX + p;
        }

        // Add Text Prompt
        parts.push({ text: finalPrompt });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                imageConfig: {
                    aspectRatio: apiAspectRatio as any, // Cast to any to satisfy TS enum if 9:16 matches
                    // count: 1  <-- Important: We enforce 1 per call to ensure the style applies fully
                }
            }
        });

        // Extract Image
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    });

    // Wait for all to finish
    const results = await Promise.all(imagePromises);
    const validImages = results.filter(img => img !== null) as string[];

    if (validImages.length === 0) {
        throw new Error("No images were generated.");
    }

    return {
        images: validImages,
        text: count > 1 
            ? `I've created ${validImages.length} distinct variations based on your request.` 
            : "Here is your generated wallpaper."
    };

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
