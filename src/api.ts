import { DetailedCardData, SandboxCode, StaticGuideCardData } from './types';
import { stripHtml } from './utils';

// No-op initialization (Compatibility with existing index.tsx)
export function initAI(apiKey: string) {
    console.log("AI initialized (Backend Proxy Mode)");
}

export async function callGeminiForPlan(userInput: string): Promise<string> {
    const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to generate plan');
    return data.text;
}

export async function callGeminiForClarification(conversationHistory: string): Promise<string> {
    const response = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationHistory })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to get clarification');
    return data.text;
}

export async function callGeminiForChat(
    card: DetailedCardData | StaticGuideCardData,
    userQuery: string,
    projectContext: string = ''
): Promise<string> {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card, userQuery, projectContext })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to chat');
    return data.text;
}

export async function callGeminiForBreakdown(card: DetailedCardData): Promise<string> {
    const response = await fetch('/api/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardTitle: card.title, cardContent: card.content })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to breakdown task');
    return data.text;
}

export async function callGeminiForCloudPrompt(card: DetailedCardData, projectDescription: string): Promise<string> {
    const response = await fetch('/api/cloud-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card, projectDescription })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to generate cloud prompt');
    return data.text;
}

export async function callGeminiForTool(toolTitle: string, input: string, projectContext?: string): Promise<string> {
    const response = await fetch('/api/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolTitle, input, projectContext })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Tool failed');
    return data.text; // Main tool endpoint returns .text
}

export async function callGeminiForGitHubTool(action: string, input: string): Promise<string> {
    const response = await fetch('/api/github-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, input })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'GitHub tool failed');
    return data.text;
}

export async function callGeminiForSandbox(prompt: string): Promise<SandboxCode> {
    const response = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Sandbox generation failed');

    // Server returns { text: JSON_STRING }, we need to parse it here if the server didn't send an object?
    // Wait, server sends { text: result.text }. result.text IS the JSON string.
    // SandboxCode expects an object.
    try {
        const parsed = JSON.parse(data.text);
        if (typeof parsed.html === 'string' && typeof parsed.css === 'string' && typeof parsed.js === 'string') {
            return parsed as SandboxCode;
        } else {
            throw new Error("AI response format invalid");
        }
    } catch (e) {
        console.error("Failed to parse sandbox JSON from server:", e);
        throw new Error("Invalid sandbox response from server");
    }
}

export async function callGeminiForSandboxEdit(
    currentHtml: string,
    currentCss: string,
    currentJs: string,
    userPrompt: string
): Promise<SandboxCode> {
    const response = await fetch('/api/sandbox-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentHtml, currentCss, currentJs, userPrompt })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Sandbox edit failed');

    try {
        const parsed = JSON.parse(data.text);
        if (typeof parsed.html === 'string' && typeof parsed.css === 'string' && typeof parsed.js === 'string') {
            return parsed as SandboxCode;
        } else {
            throw new Error("AI response format invalid");
        }
    } catch (e) {
        console.error("Failed to parse sandbox JSON from server:", e);
        throw new Error("Invalid sandbox response from server");
    }
}
