// src/ai.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const MODEL_NAME = "gemini-2.5-pro-preview-03-25"; // Or choose another suitable model

export class GeminiClient {
    private genAI: GoogleGenerativeAI;
    private apiKey: string;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Gemini API key is required.");
        }
        this.apiKey = apiKey;
        this.genAI = new GoogleGenerativeAI(this.apiKey);
    }

    private buildPrompt(fileList: string[], userQuery: string): string {
        const fileListString = fileList.join("\n");

        return `
Given the following list of file paths found in a project:

${fileListString}

The user wants to find files related to: "${userQuery}"

Based on the user's request and the file paths, please identify the most relevant files from the list provided above. List *only* the relevant file paths from the list, each on a new line. Do not include any other text, explanations, or formatting. If no files seem relevant, return an empty response.
        `.trim();
    }

    async findRelevantFiles(allFiles: string[], userQuery: string): Promise<string[]> {
        if (allFiles.length === 0) {
            console.warn("AI Mode: No files found to analyze.");
            return [];
        }

        const prompt = this.buildPrompt(allFiles, userQuery);
        const model = this.genAI.getGenerativeModel({ model: MODEL_NAME });

        const generationConfig = {
            temperature: 0.2, // Lower temperature for more predictable list output
            topK: 1,
            topP: 1,
            maxOutputTokens: 4096, // Adjust as needed, consider file list size
        };

        // Safety settings might need adjustment depending on file paths/queries
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        try {
             console.log("AI Mode: Sending request to Gemini..."); // User feedback
            const result = await model.generateContent({
                 contents: [{ role: "user", parts: [{ text: prompt }] }],
                 generationConfig,
                 safetySettings,
             });

             const response = result.response;
             const responseText = response.text();
             console.log("AI Mode: Received response."); // User feedback

             if (!responseText) {
                 console.log("AI Mode: Gemini returned an empty response.");
                 return [];
             }

             // Split the response text into lines and filter out empty lines
             const relevantFiles = responseText
                 .split('\n')
                 .map(line => line.trim())
                 .filter(line => line && allFiles.includes(line)); // Ensure Gemini returns paths that were actually in the input list

             if (relevantFiles.length === 0 && responseText.trim().length > 0) {
                 console.warn("AI Mode: Gemini response didn't contain any paths from the original list. Response was:\n", responseText);
             } else if (relevantFiles.length > 0) {
                 console.log(`AI Mode: Gemini identified ${relevantFiles.length} relevant files.`);
             }

             return relevantFiles;

        } catch (error: any) {
             console.error("AI Mode: Error calling Gemini API:", error);
             // Check for safety feedback
             if (error.response && error.response.promptFeedback) {
                 console.error("Prompt Feedback:", error.response.promptFeedback);
             }
             // Rethrow or handle more gracefully
             throw new Error(`Gemini API request failed: ${error.message}`);
        }
    }
}