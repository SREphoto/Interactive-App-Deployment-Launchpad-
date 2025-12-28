import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.VITE_GEMINI_API_KEY; // Read from existing env var name for compatibility

if (!API_KEY) {
    console.error("CRITICAL ERROR: VITE_GEMINI_API_KEY is missing from environment variables.");
    // We don't exit to allow the static site to at least load, but API calls will fail.
}

// Initialize Gemini Client
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'dist' directory (Vite build output)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'dist')));

// --- API Endpoints ---

// Helper for generic text generation
async function generateText(model, prompt, systemInstruction) {
    if (!ai) throw new Error("AI Client not initialized.");
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: { systemInstruction }
    });
    return response.text;
}

// 1. Generate Plan
app.post('/api/plan', async (req, res) => {
    try {
        const { userInput } = req.body;
        const systemInstruction = `You are an expert project manager and senior software architect specializing in deploying web applications using Google Cloud and Firebase.
Your task is to create a detailed, step-by-step project plan based on a user's project description.

The output MUST be a single JSON object. Do not include any text, markdown, or code formatting before or after the JSON object.

The JSON object must have a single root key: "plan". The value of "plan" must be an array of "card" objects.

Each "card" object must have the following properties:
- "id": A unique, url-safe string identifier (e.g., "setup-gcp-project").
- "title": A concise, descriptive title for the step (e.g., "Google Cloud Project Setup").
- "type": A string enum. Must be one of: "step", "decision", "option-best", "option-other", "warning".
- "content": A detailed explanation of the step in HTML format. Use <p>, <ul>, <ol>, <li>, <a>, <strong>, <code>. Do NOT use markdown.
- "decisionContextId" (optional): For cards of type "option-best" or "option-other", this MUST be the "id" of the parent "decision" card.
- "activatedByOptionId" (optional): For "step" or "decision" cards that only apply if a specific option is chosen, this MUST be the "id" of the "option-best" or "option-other" card that activates it.

Guidelines for card generation:
1.  **Logical Flow**: The plan should start from project setup and progress logically through backend, frontend, security, testing, and deployment.
2.  **Decision Points**: When there are common choices (e.g., database type, authentication provider), create a "decision" card. Then, provide at least two corresponding "option-best" or "option-other" cards. Use "option-best" for the most common or recommended choice.
3.  **Conditional Paths**: Use "activatedByOptionId" to create branching paths. For example, if a user chooses the "Firebase Hosting" option, the subsequent step "Deploy to Firebase" should have its "activatedByOptionId" set to the ID of the "Firebase Hosting" card.
4.  **Security First**: Always include critical security warnings and steps, especially regarding API key management. A "warning" card type is suitable for this.
5.  **Be Comprehensive**: Cover the entire lifecycle: Setup, Secure Key Management, Backend (Proxy), CORS, Frontend, Build Process, Hosting, and considerations for Authentication and Storage.
6.  **Clarity and Detail**: The "content" for each card should be clear enough for a junior developer to understand and act upon. Include links to official documentation where helpful.`;

        const prompt = `User's project description: "${userInput}"`;
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json" }
        });
        res.json({ text: result.text });
    } catch (error) {
        console.error("API /api/plan error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Clarification
app.post('/api/clarify', async (req, res) => {
    try {
        const { conversationHistory } = req.body;
        const systemInstruction = `You are an AI project planner. A user has given you a project description. Your job is to ask a few (2-3 max) critical, clarifying questions to better understand the project scope before you generate a detailed deployment plan.
Focus on questions that would significantly change the plan, such as:
- The need for user accounts (authentication).
- The type of data to be stored (database choice).
- Any specific technologies they must use.
- The scale of the application (e.g., hobby project vs. enterprise).

Keep your response conversational and end by asking the user to provide more details. Do not generate the plan yet.`;

        const result = await generateText('gemini-2.5-flash', conversationHistory, systemInstruction);
        res.json({ text: result });
    } catch (error) {
        console.error("API /api/clarify error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Chat
app.post('/api/chat', async (req, res) => {
    try {
        const { card, userQuery, projectContext } = req.body;

        // Helper to strip HTML (simplified version of the client-side one)
        const stripHtml = (html) => html.replace(/<[^>]*>?/gm, '');
        const cardContentText = stripHtml(card.content || '');
        const previousChat = (card.chatHistory || []).map(msg => `${msg.sender}: ${msg.text}`).join('\n');

        const systemInstruction = `You are a helpful AI assistant providing guidance on a specific step of a web deployment plan.
The user is asking for help with the step titled "${card.title}".
The content of this step is:
---
${cardContentText}
---
${projectContext || ''}

Your instructions:
1.  Your primary goal is to answer the user's question directly in the context of this step.
2.  Be concise and to the point. Use markdown for formatting if needed.
3.  If the user's question implies they need to add a new step to their plan (e.g., "how do I add image uploads?"), you MUST format your suggestion as a special JSON block at the end of your conversational response. The format is:
    [ADD_STEP]
    {
      "title": "A concise title for the new step",
      "type": "step",
      "content": "A detailed HTML explanation for the new step."
    }
4.  Only include the [ADD_STEP] block if it's a clear, actionable new step. Do not use it for simple clarifications.`;

        const fullPrompt = `Previous conversation:
${previousChat}
user: ${userQuery}
ai:`;

        const result = await generateText('gemini-2.5-flash', fullPrompt, systemInstruction);
        res.json({ text: result });
    } catch (error) {
        console.error("API /api/chat error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Breakdown
app.post('/api/breakdown', async (req, res) => {
    try {
        const { cardTitle, cardContent } = req.body;
        // Helper to strip HTML
        const stripHtml = (html) => html.replace(/<[^>]*>?/gm, '');

        const systemInstruction = `You are a helpful assistant that breaks down a complex task into a series of simple, actionable sub-steps.
The user needs to complete the task: "${cardTitle}".
The details of the task are:
---
${stripHtml(cardContent || '')}
---
Your response must be a plain text list of sub-steps. Each sub-step must start with "- [ ] ". Do not include any other text or explanation.`;

        const result = await generateText('gemini-2.5-flash', `Break down the task: "${cardTitle}"`, systemInstruction);
        res.json({ text: result });
    } catch (error) {
        console.error("API /api/breakdown error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Cloud Prompt
app.post('/api/cloud-prompt', async (req, res) => {
    try {
        const { card, projectDescription } = req.body;
        const stripHtml = (html) => html.replace(/<[^>]*>?/gm, '');

        const systemInstruction = `You are an AI assistant that generates expert-level prompts for Gemini in Google Cloud.
Your goal is to create a prompt that helps a developer accomplish a specific task related to their project.

The user's overall project is: "${projectDescription || 'A web application.'}"
The specific step they are working on is titled: "${card.title}"
The details of this step are:
---
${stripHtml(card.content || '')}
---
Generate a single, clear, and effective prompt that the user can copy and paste into Gemini in Cloud. The prompt should ask for code, configuration examples, or best practices related to the step, incorporating the context of their project. Do not add any explanation or preamble. Only output the raw prompt text.`;

        const result = await generateText('gemini-2.5-flash', 'Generate the prompt.', systemInstruction);
        res.json({ text: result });
    } catch (error) {
        console.error("API /api/cloud-prompt error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 6. Tool
app.post('/api/tool', async (req, res) => {
    try {
        const { toolTitle, input, projectContext } = req.body;
        let systemInstruction = '';
        let prompt = input;

        if (toolTitle === "PRD Generator") {
            systemInstruction = `You are an expert product manager. A user will provide a project idea, and you will generate a concise but formal Product Requirements Document (PRD) based on it. If the user provides additional context about their current project plan (description, roadmap, decisions), you MUST use that context to create a more detailed and accurate PRD.
    The PRD should be in markdown format and include the following sections:
    - **1. Introduction & Goal:** Briefly explain the project and its primary objective.
    - **2. Target Audience:** Describe the intended users.
    - **3. Key Features:** A bulleted list of the most important features.
    - **4. Technical Considerations:** High-level thoughts on technology stack or architecture.
    - **5. Success Metrics:** How will the success of this project be measured?`;
        } else if (toolTitle === "Mermaid Diagram Builder") {
            systemInstruction = `You are a system architect that generates Mermaid.js diagram code.
    A user will describe a flow or system in plain English.
    You must respond ONLY with the Mermaid.js code inside a \`\`\`mermaid\`\`\` code block. Do not include any other text, explanation, or markdown formatting.
    Start the diagram with \`graph TD\`.`;
            prompt = `Generate Mermaid code for this description: ${input}`;
        } else if (toolTitle === "MVP Feature Scoper") {
            systemInstruction = `You are a seasoned product manager focused on lean startups. A user will provide a project idea. Your task is to analyze it and define a minimal set of core features required for a Minimum Viable Product (MVP). If the user provides additional context about their current project plan (description, roadmap, decisions), you MUST use that context to scope the MVP features more accurately. List the features in a markdown bulleted list, focusing only on what is absolutely essential for the first launch to test the core hypothesis.`;
        } else if (toolTitle === "Future Feature Ideator") {
            systemInstruction = `You are a creative product strategist and futurist. A user will describe their existing application or MVP. Your task is to brainstorm and suggest a list of potential future features. Categorize them into '### Next Steps' (logical next features) and '### Ambitious Ideas' (moonshot features for long-term growth). Present the output in markdown format with these two headings.`;
        }

        if (projectContext) {
            prompt = `${projectContext}\n\nUser's request: ${input}`;
        }

        const result = await generateText('gemini-2.5-flash', prompt, systemInstruction);
        res.json({ text: result });
    } catch (error) {
        console.error("API /api/tool error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 7. GitHub Tool
app.post('/api/github-tool', async (req, res) => {
    try {
        const { action, input } = req.body;
        let systemInstruction = '';
        let prompt = input;

        switch (action) {
            case ".gitignore":
                systemInstruction = `You are an expert on Git and repository management. A user will provide a list of technologies, frameworks, and tools. Your task is to generate a comprehensive .gitignore file content for that specific stack. Respond ONLY with the raw .gitignore content. Do not include any markdown, code blocks (like \`\`\`), or explanations.`;
                prompt = `Generate a .gitignore for the following stack: ${input}`;
                break;
            case "branch-name":
                systemInstruction = `You are an expert on Git branching strategies. A user will describe a task. Your task is to suggest 3-5 conventional and well-formatted Git branch names for it. Use common prefixes like 'feature/', 'fix/', 'chore/', 'docs/'. Present the suggestions as a markdown bulleted list. Do not include any other text or explanation.`;
                prompt = `Suggest branch names for this task: ${input}`;
                break;
            case "pr-template":
                systemInstruction = `You are an expert on software development best practices. Your task is to generate a high-quality, generic Pull Request (PR) template in markdown format. It should include sections for '## Description', '## Changes Made', and '## How to Test'. Respond ONLY with the raw markdown template content. Do not include any other text or explanation.`;
                prompt = 'Generate the PR template.';
                break;
            default:
                throw new Error(`Unknown GitHub tool action: ${action}`);
        }

        const result = await generateText('gemini-2.5-flash', prompt, systemInstruction);
        res.json({ text: result });
    } catch (error) {
        console.error("API /api/github-tool error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 8. Sandbox
app.post('/api/sandbox', async (req, res) => {
    try {
        const { prompt } = req.body;
        const systemInstruction = `You are an expert frontend web developer. Your task is to generate the complete, self-contained HTML, CSS, and JavaScript code for a simple web application based on a user's prompt.

The output MUST be a single, valid JSON object. Do not include any text, markdown, or code formatting like \`\`\`json before or after the JSON object.

The JSON object must have exactly three keys: "html", "css", and "js".
- The "html" value should be the content for the <body> tag.
- The "css" value should be the full CSS stylesheet.
- The "js" value should be the full JavaScript code.

The generated code must be simple, functional, and not rely on any external libraries or frameworks. Use vanilla JavaScript, HTML, and CSS. The JavaScript should be placed in the 'js' key, not inline in the HTML.`;

        if (!ai) throw new Error("AI Client not initialized.");
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `User prompt: "${prompt}"`,
            config: { systemInstruction, responseMimeType: "application/json" }
        });

        res.json({ text: result.text });
    } catch (error) {
        console.error("API /api/sandbox error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Catch-all for SPA client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
