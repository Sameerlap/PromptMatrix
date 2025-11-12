import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | undefined;

/**
 * Initializes the singleton GoogleGenAI client.
 * This must be called once at application startup.
 * @throws {Error} if the API_KEY environment variable is not set.
 */
export const initializeAiClient = (): void => {
    if (ai) {
        return; // Already initialized
    }
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API key is not configured. Please ensure the API_KEY environment variable is set.");
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
};

/**
 * Gets the initialized AI client.
 * @throws {Error} if the client has not been initialized.
 * @returns {GoogleGenAI} The singleton GoogleGenAI instance.
 */
const getAiClient = (): GoogleGenAI => {
    if (!ai) {
        throw new Error("Gemini AI client has not been initialized. Please call initializeAiClient first.");
    }
    return ai;
};

export const enhancePrompt = async (userInput: string, template: string, model: string): Promise<string> => {
    const finalPrompt = template.replace('{userInput}', userInput);
    const genAI = getAiClient();

    try {
        const response = await genAI.models.generateContent({
            model: model,
            contents: finalPrompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error enhancing prompt:", error);
        throw new Error("Failed to communicate with the Gemini API. Please check your connection and API key.");
    }
};

export const refinePrompt = async (currentPrompt: string, refinementInstruction: string): Promise<string> => {
    const finalPrompt = `You are an expert AI prompt editor. Your sole task is to rewrite an existing AI prompt based on a specific user instruction. You must integrate the user's requested change seamlessly into the prompt, enhancing it while preserving its core idea.

**Crucial Instructions:**
-   Analyze the **Existing Prompt** and the **User's Refinement Instruction** carefully.
-   Rewrite the entire prompt to incorporate the instruction.
-   Output ONLY the new, rewritten prompt.
-   Do NOT include any conversational text, explanations, apologies, or labels like "New Prompt:". The output must be ready to be copied and used directly.
-   If the instruction is in Hinglish (e.g., "isko thoda aur creative banao"), apply its meaning to the English prompt and output the newly refined English prompt.

**Existing Prompt:**
---
${currentPrompt}
---

**User's Refinement Instruction:**
---
${refinementInstruction}
---

Now, generate the new, rewritten prompt.`;
    const genAI = getAiClient();

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-pro', // Using the more powerful model for high-quality refinement
            contents: finalPrompt,
        });
        
        return response.text.trim();
    } catch (error) {
        console.error("Error refining prompt:", error);
        throw new Error("Failed to communicate with the Gemini API for refinement.");
    }
};

export const getSuggestions = async (enhancedPrompt: string): Promise<string[]> => {
    const suggestionPrompt = `You are an AI Prompt Ideator. Your task is to analyze the following prompt and generate 3-4 specific, creative, and actionable suggestions for how to modify it. These suggestions will be presented to a user as one-click buttons to refine their prompt.

**Existing Prompt:**
---
${enhancedPrompt}
---

**Instructions for generating suggestions:**
1.  **Read the prompt carefully** to understand its subject, style, and intent.
2.  **Generate 3 or 4 distinct ideas.** Don't suggest minor tweaks. Each suggestion should offer a noticeable change in direction (e.g., a different mood, style, composition, or a surprising new element).
3.  **Phrase each suggestion as a command.** The suggestion itself will be used as an instruction to another AI. Start with a verb.
4.  **Keep suggestions concise and clear.** They should be easy to understand at a glance.
5.  **Examples of good suggestions:** "Set the scene during a solar eclipse," "Change the art style to nostalgic 90s anime," "Add a mysterious, glowing artifact in the foreground," "Make the mood more melancholic and somber."

**Output Format:**
- You must respond in the specified JSON format.
- Do not add any extra text, explanations, or markdown formatting.`;
    const genAI = getAiClient();

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: suggestionPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestions: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        
        const jsonResponse = JSON.parse(response.text);
        if (jsonResponse && Array.isArray(jsonResponse.suggestions)) {
            return jsonResponse.suggestions;
        }
        return [];
    } catch (error) {
        console.error("Error getting suggestions:", error);
        throw new Error("Failed to get suggestions from the API.");
    }
};

export const correctText = async (text: string): Promise<string> => {
    const correctionPrompt = `You are a proofreader. Correct all spelling and grammar mistakes in the following text. Return only the corrected text, without any additional explanations, headers, or formatting.

Original Text:
---
${text}
---

Corrected Text:`;
    const genAI = getAiClient();

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: correctionPrompt,
        });
        
        return response.text.trim();
    } catch (error) {
        console.error("Error correcting text:", error);
        throw new Error("Failed to correct text using the Gemini API.");
    }
};

export const processFeedback = async (name: string, feedback: string): Promise<{ category: string, summary: string, priority: string }> => {
    const feedbackPrompt = `You are an AI assistant responsible for processing user feedback for a web application called "PromptMatrix". Your task is to analyze the feedback, categorize it, provide a brief summary, and assign a priority level.

**User Information:**
- Name: ${name || 'Anonymous'}

**User Feedback:**
---
${feedback}
---

**Instructions:**
1.  **Analyze the feedback's sentiment and content.**
2.  **Categorize the feedback** into one of the following: "Bug Report", "Feature Request", "General Comment", "Praise", or "UI/UX Improvement".
3.  **Summarize the core message** of the feedback in one short sentence.
4.  **Assign a priority level:** "High", "Medium", or "Low". High priority should be for critical bugs or major feature requests.
5.  **Respond ONLY with a JSON object** in the specified format. Do not include any other text, explanations, or markdown.
`;

    const genAI = getAiClient();

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: feedbackPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        category: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        priority: { type: Type.STRING }
                    },
                    required: ["category", "summary", "priority"]
                }
            }
        });
        
        const jsonResponse = JSON.parse(response.text);
        return jsonResponse;
    } catch (error) {
        console.error("Error processing feedback:", error);
        throw new Error("Failed to process feedback using the Gemini API.");
    }
};

export const generateImageFromPrompt = async (prompt: string, aspectRatio: string): Promise<string> => {
    const genAI = getAiClient();
  // Imagen models require Vertex AI which is not configured
    try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [prompt],
    });

    if (response.parts && response.parts.length > 0) {
      // Find the image part
      for (const part of response.parts) {
        if (part.inline_data && part.inline_data.mime_type?.startsWith('image/')) {
          const base64ImageBytes = part.inline_data.data;
          return `data:${part.inline_data.mime_type};base64,${base64ImageBytes}`;
        }
      }
      throw new Error("No image generated in response");
    } else {
      throw new Error("The API did not return any images.");
    }
  }
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
    } else {
            throw new Error("The API did not return any images.");
        }
    } catch (error) {
        console.error("Error generating image:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
             throw new Error("Image generation was blocked due to safety policies. Please modify your prompt and try again.");
        }
        throw new Error("Failed to generate the image using the Gemini API.");
    }
};
