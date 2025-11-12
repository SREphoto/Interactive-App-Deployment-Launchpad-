/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from "marked";
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// --- Data for the original Deployment Guide ---
const GUIDE_VERSION = "1.3.0";
const GUIDE_LAST_UPDATED = "2024-08-02";
const LOCAL_STORAGE_KEY = 'aiLaunchpadState_v1_3';

// Default suggested prompts for chat interfaces
const DEFAULT_CHAT_CHIPS = [
    "Explain this in simpler terms",
    "Give me a code example for this",
    "What are the alternatives to this approach?",
];


declare var mermaid: any;

interface StaticGuideCardData {
  title: string;
  content: string; // HTML content
  children?: StaticGuideCardData[];
  chatHistory?: ChatMessage[];
  isChatLoading?: boolean;
  chatError?: string | null;
  currentChatQuery?: string;
  suggestedStep?: { title: string; type: CardType; content: string; } | null;
  isTool?: boolean;
  chatChips?: string[];
}

const toolData: StaticGuideCardData[] = [
    {
        title: "PRD Generator",
        isTool: true,
        content: `
            <p>Generate a Product Requirements Document (PRD) for your project. Describe your core idea, target audience, and key features below, and the AI will structure it into a formal PRD.</p>
        `
    },
    {
        title: "MVP Feature Scoper",
        isTool: true,
        content: `
            <p>Describe your project, and the AI will help you identify the core features for a Minimum Viable Product (MVP) to launch quickly and test your core idea.</p>
        `
    },
    {
        title: "Future Feature Ideator",
        isTool: true,
        content: `
            <p>Already have an MVP? Describe your current project, and the AI will brainstorm innovative and logical next-step features to add to your roadmap.</p>
        `
    },
    {
        title: "Mermaid Diagram Builder",
        isTool: true,
        content: `
            <p>Visualize your application's architecture, user flows, or database schemas. Describe the structure or process in plain English, and the AI will generate the Mermaid.js code to create a diagram.</p>
            <p><strong>Example prompt:</strong> "A user logs in. If successful, they are taken to the dashboard. From the dashboard, they can view their profile or create a new project."</p>
        `
    },
    {
        title: "Project File Manager",
        isTool: true,
        content: `
            <p>Manage your project's assets and files. Upload files directly from your computer or connect to cloud storage providers. This is useful for providing context to other AI tools or for managing project assets.</p>
        `
    },
    {
        title: "GitHub Assistant",
        isTool: true,
        content: `
            <p>A suite of AI-powered tools to help with common GitHub-related tasks, from repository setup to pull request management.</p>
            <div class="sub-tool-container">
                <h4>.gitignore Generator</h4>
                <p>Describe your tech stack (e.g., "Node.js, React, VSCode config") to generate a tailored <code>.gitignore</code> file.</p>
                <form class="tool-form" data-tool-title="GitHub Assistant:.gitignore">
                    <label for="tool-input-gitignore" class="sr-only">.gitignore tech stack</label>
                    <textarea id="tool-input-gitignore" class="tool-input" placeholder="e.g., Node, Python, Vite" rows="2"></textarea>
                    <button type="submit" class="action-btn" aria-label="Generate .gitignore">Generate</button>
                </form>
                 <div id="tool-output-GitHub-Assistant:.gitignore" role="status" aria-live="polite"></div>
            </div>
            <div class="sub-tool-container">
                <h4>Branch Name Suggester</h4>
                <p>Describe your task (e.g., "fix login button bug," "add user profile page") to get conventional branch name suggestions.</p>
                <form class="tool-form" data-tool-title="GitHub Assistant:branch-name">
                    <label for="tool-input-branch-name" class="sr-only">Branch task description</label>
                    <textarea id="tool-input-branch-name" class="tool-input" placeholder="e.g., fix login button alignment" rows="2"></textarea>
                    <button type="submit" class="action-btn" aria-label="Suggest Branch Name">Suggest</button>
                </form>
                <div id="tool-output-GitHub-Assistant:branch-name" role="status" aria-live="polite"></div>
            </div>
            <div class="sub-tool-container">
                <h4>Pull Request Template Generator</h4>
                <p>Generate a standard, professional PR template to ensure your pull requests are clear and easy to review.</p>
                <form class="tool-form" data-tool-title="GitHub Assistant:pr-template">
                     <button type="submit" class="action-btn" aria-label="Generate PR Template">Generate Template</button>
                </form>
                <div id="tool-output-GitHub-Assistant:pr-template" role="status" aria-live="polite"></div>
            </div>
        `
    },
    {
        title: "Live Code Sandbox",
        isTool: true,
        content: `
            <p>Use the AI to generate a sample app, or experiment with HTML, CSS, and JavaScript in a live environment. Write your code in the panes below, click "Run," and see the result instantly.</p>
        `
    },
];

let staticGuideData: StaticGuideCardData[] = [
  {
    title: "Critical Security Checklist",
    content: `
      <p>This checklist consolidates the most critical security actions. Ensure you can check every box before deploying a public-facing application.</p>
      <ul class="security-checklist">
        <li>
          <input type="checkbox" id="sec-check-1" aria-labelledby="sec-label-1">
          <label for="sec-check-1" id="sec-label-1">API Keys are <strong>NEVER</strong> present in frontend (client-side) code (e.g., JavaScript, TSX files).</label>
        </li>
        <li>
          <input type="checkbox" id="sec-check-2" aria-labelledby="sec-label-2">
          <label for="sec-check-2" id="sec-label-2">A backend proxy (e.g., Cloud Function, server) is used to make all calls to the Gemini API.</label>
        </li>
        <li>
          <input type="checkbox" id="sec-check-3" aria-labelledby="sec-label-3">
          <label for="sec-check-3" id="sec-label-3">The Gemini API Key is stored securely in a secret management service (e.g., Google Secret Manager).</label>
        </li>
        <li>
          <input type="checkbox" id="sec-check-4" aria-labelledby="sec-label-4">
          <label for="sec-check-4" id="sec-label-4">The backend function's service account has the principle of least privilege (e.g., only the "Secret Manager Secret Accessor" role, not Editor).</label>
        </li>
        <li>
          <input type="checkbox" id="sec-check-5" aria-labelledby="sec-label-5">
          <label for="sec-check-5" id="sec-label-5">CORS on the backend is configured to allow <strong>ONLY</strong> your specific frontend domain in production.</label>
          <div class="checklist-note"><strong>Note:</strong> If using Firebase Hosting, your domain is typically <code>your-project-id.web.app</code> or <code>your-project-id.firebaseapp.com</code>. You can find the exact URL in the Firebase Hosting console after your first deployment.</div>
        </li>
         <li>
          <input type="checkbox" id="sec-check-6" aria-labelledby="sec-label-6">
          <label for="sec-check-6" id="sec-label-6">Authentication is required for sensitive backend endpoints to prevent unauthorized access.</label>
        </li>
        <li>
          <input type="checkbox" id="sec-check-7" aria-labelledby="sec-label-7">
          <label for="sec-check-7" id="sec-label-7">Application dependencies are regularly scanned for known vulnerabilities (e.g., using <code>npm audit</code>).</label>
        </li>
      </ul>
    `
  },
  {
    title: "Lifecycle & Strategy",
    content: `<p>Guides on project planning, collaboration, and adapting to new requirements.</p>`,
    children: [
        {
            title: "Git Branching Strategy Guide",
            isTool: false,
            content: `
                <p>Choosing the right Git branching strategy is crucial for team collaboration and release management. Here's an overview of popular models.</p>
                <h4>GitHub Flow</h4>
                <p>A lightweight, branch-based workflow. The <code>main</code> branch is always deployable. All development is done on feature branches, which are created from <code>main</code>. When a feature is complete, it's reviewed via a Pull Request and merged back into <code>main</code> to be deployed.</p>
                <ul>
                    <li><strong>Pros:</strong> Simple, clean, fast. Excellent for teams that practice continuous deployment.</li>
                    <li><strong>Cons:</strong> May not be suitable for projects with scheduled releases or multiple versions to support.</li>
                </ul>
                <h4>GitFlow</h4>
                <p>A more structured model with two main branches: <code>main</code> (for production releases) and <code>develop</code> (for integrating features). It uses supporting branches for features, releases, and hotfixes.</p>
                <ul>
                    <li><strong>Pros:</strong> Very structured and organized. Ideal for projects with scheduled release cycles and the need to support multiple versions in production.</li>
                    <li><strong>Cons:</strong> Can be complex and add overhead for smaller teams or projects that deploy frequently.</li>
                </ul>
                 <h4>Trunk-Based Development</h4>
                <p>All developers work on a single branch called the "trunk" (<code>main</code>). Changes are integrated continuously in small batches. Feature flags are used to hide incomplete features from users. Releases are created by tagging a specific commit on the trunk.</p>
                <ul>
                    <li><strong>Pros:</strong> Enforces a truly continuous integration pipeline. Avoids complex merge conflicts.</li>
                    <li><strong>Cons:</strong> Requires a mature testing culture and robust feature flag system. Not ideal for beginners.</li>
                </ul>
            `
        },
        {
            title: "Reassessment & Plan Adjustment",
            content: `
                <p>Plans change. If you've encountered a roadblock, discovered a new requirement, or realized an earlier decision wasn't right for your project, this tool can help.</p>
                <p>Describe your situation in the <span class="highlight-chat">chat below</span>. The AI has access to your current plan (your project description, decisions made, and completed steps) and can provide contextual advice. It can help you figure out how to pivot and can even suggest new, custom steps to add to your roadmap.</p>
                <p><strong>Example prompts:</strong></p>
                <ul>
                    <li>"I chose Firestore, but now I realize I need a relational database like Cloud SQL. What do I need to change?"</li>
                    <li>"My app needs to support image uploads, which we didn't plan for initially. What steps should I add?"</li>
                    <li>"The 'Firebase Authentication' option won't work for my use case. I need to integrate with a custom OAuth provider instead."</li>
                </ul>
            `,
             chatChips: [
                "I chose Firestore, but now I realize I need a relational database. What should I do?",
                "My app needs to support image uploads, which we didn't plan for. What steps should I add?",
                "The 'Firebase Authentication' option won't work for my use case. How do I integrate a custom OAuth provider?"
            ]
          },
    ]
  },
  {
    title: "Introduction & Critical Security Warning",
    content: `
      <h2>Purpose of This Guide</h2>
      <p>This guide provides a structured approach to developing and deploying a web application, particularly when interacting with powerful APIs like Google's Gemini. It covers essential steps from initial setup to going live, with a strong emphasis on security and best practices.</p>
      <h2><strong class="critical-warning">CRITICAL: NEVER Expose API Keys in Client-Side Code (Frontend)</strong></h2>
      <p>If your application uses an API key (like a Gemini API key), it <strong>MUST NOT</strong> be embedded directly in your frontend JavaScript code (e.g., in this <code>index.tsx</code> if it were making direct API calls in a public app) or made accessible to the browser in any way for a production application.</p>
      <h3>Why is this critical?</h3>
      <ul>
        <li><strong>Theft:</strong> Anyone can view your website's source code in their browser. If the API key is there, they can steal it.</li>
        <li><strong>Abuse:</strong> A stolen API key can be used by malicious actors to make unauthorized calls, potentially leading to high costs, quota exhaustion, or other misuse under your account.</li>
      </ul>
      <h3>The Secure Architecture:</h3>
      <ol>
        <li><strong>Frontend (Client-Side):</strong> Your web application (HTML, CSS, JavaScript running in the user's browser). It <em>collects user input</em>.</li>
        <li><strong>Backend (Server-Side):</strong> A secure server or cloud function that your frontend calls. This backend service is where your API key is securely stored and used.</li>
        <li><strong>Gemini API (or other service):</strong> The backend service makes requests to the Gemini API using the secured key.</li>
      </ol>
      <p>This guide will show you how to set up such a backend.</p>
      <p class="critical-warning"><strong>Note for this AI Launchpad Tool:</strong> If using the Gemini API directly from the client-side as implemented here, ensure <code>process.env.API_KEY</code> is managed securely and is not exposed in a publicly deployed bundle. For public production apps, a backend proxy is the standard secure method.</p>
    `
  },
  {
    title: "Google Cloud Project Setup",
    content: `
      <h2>1. Create or Select a Google Cloud Project</h2>
      <ul>
        <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>.</li>
        <li>If you don't have a project, click "Select a project" then "NEW PROJECT". Follow the prompts.</li>
        <li>Otherwise, select the existing project you want to use.</li>
      </ul>
      <h2>2. Enable Necessary APIs</h2>
      <p>APIs allow your project to use specific Google Cloud services.</p>
      <ul>
        <li>In the Cloud Console, navigate to "APIs & Services" > "Library" using the search bar or navigation menu.</li>
        <li>Search for and enable the following APIs for your project:
          <ul>
            <li><strong>Generative Language API</strong> (or Vertex AI API if using Vertex AI models): Allows use of Gemini models.</li>
            <li><strong>Cloud Functions API</strong>: To create serverless backend functions.</li>
            <li><strong>Secret Manager API</strong>: For securely storing your API key.</li>
            <li><strong>Cloud Build API</strong>: Often required for deploying Cloud Functions (may be enabled automatically).</li>
            <li>(Optional, for hosting) <strong>Firebase API</strong>: If you plan to use Firebase services like Hosting.</li>
          </ul>
        </li>
        <li>Click "Enable" for each API. You might need to wait a moment for enabling to complete.</li>
      </ul>
      <p>Ensure billing is enabled for your project, as many of these services are paid (though they often have free tiers).</p>
    `
  },
  {
    title: "Secure API Key Management (Secret Manager)",
    content: `
      <h2>1. Obtain Your Gemini API Key</h2>
      <p>If you haven't already, get your Gemini API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.</p>
      <h2>2. Store the API Key in Google Cloud Secret Manager</h2>
      <p>Secret Manager provides a secure and convenient way to store API keys, passwords, certificates, and other sensitive data.</p>
      <ol>
        <li>In the Google Cloud Console, navigate to "Security" > "Secret Manager".</li>
        <li>Click "<strong>Create Secret</strong>".</li>
        <li><strong>Name:</strong> Give your secret a descriptive name (e.g., <code>gemini-api-key</code>). This is the ID you'll use to refer to it.</li>
        <li><strong>Secret value:</strong> Paste your actual Gemini API key into this field.</li>
        <li><strong>Regions:</strong> You can typically leave this as "Automatic" or choose specific regions if needed.</li>
        <li>Leave other settings at their defaults unless you have specific requirements.</li>
        <li>Click "<strong>Create Secret</strong>".</li>
      </ol>
      <h3>Why use Secret Manager?</h3>
      <ul>
        <li><strong>Security:</strong> Keys are encrypted at rest and access can be tightly controlled using IAM permissions.</li>
        <li><strong>Centralization:</strong> Manage all your secrets in one place.</li>
        <li><strong>Auditing:</strong> Access to secrets can be audited.</li>
        <li><strong>Rotation:</strong> Simplifies the process of updating keys.</li>
      </ul>
      <p>You will grant your backend service (Cloud Function) permission to access this secret, rather than embedding the key in code.</p>
    `
  },
    {
    title: "Backend Setup - Cloud Function Proxy",
    content: `
      <h2>Why a Backend Proxy?</h2>
      <p>As emphasized, your API key must not be in the frontend. A backend Cloud Function acts as a secure intermediary:</p>
      <ol>
        <li>Frontend sends a request (e.g., user's prompt) to your Cloud Function.</li>
        <li>Cloud Function (running on Google's servers) retrieves the Gemini API key from Secret Manager.</li>
        <li>Cloud Function makes the actual call to the Gemini API using the key.</li>
        <li>Gemini API responds to your Cloud Function.</li>
        <li>Cloud Function sends the result back to your frontend.</li>
      </ol>

      <h2>Creating the Cloud Function (Node.js Example)</h2>
      <ol>
        <li>In the Cloud Console, go to "Compute" > "<strong>Cloud Functions</strong>".</li>
        <li>Click "<strong>Create Function</strong>".</li>
        <li><strong>Configuration:</strong>
            <ul>
                <li><strong>Environment:</strong> Choose "2nd gen" (recommended for new functions).</li>
                <li><strong>Function name:</strong> E.g., <code>gemini-request-handler</code>.</li>
                <li><strong>Region:</strong> Select a region (e.g., <code>us-central1</code>).</li>
                <li><strong>Trigger type:</strong> Select "HTTP".</li>
                <li><strong>Authentication:</strong> For simplicity during development, select "Allow unauthenticated invocations".
                    <br><strong>Production Note:</strong> For a real app, you'd secure this endpoint (e.g., require authentication, use API Gateway, or Firebase App Check if your frontend is on Firebase).</li>
            </ul>
        </li>
        <li>Click "Next" or "Save" then "Next" to go to the code section.</li>
        <li><strong>Code & Runtime:</strong>
            <ul>
                <li><strong>Runtime:</strong> Select a Node.js version (e.g., Node.js 20).</li>
                <li><strong>Source Code:</strong> "Inline editor" is fine for this example. For complex functions, use ZIP upload or a source repository.</li>
                <li><strong>Entry point:</strong> This is the name of the exported function in your code that will handle requests. E.g., <code>handleGeminiRequest</code>.</li>
            </ul>
        </li>
        <li><strong><code>package.json</code> (Dependencies):</strong>
<pre><code class="language-json">{
  "name": "gemini-proxy-function",
  "version": "1.0.0",
  "dependencies": {
    "@google/generative-ai": "^0.18.0",
    "express": "^4.19.2",
    "cors": "^2.8.5"
  }
}</code></pre>
        </li>
        <li><strong><code>index.js</code> (Function Logic):</strong>
<pre><code class="language-javascript">const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require("@google/genai");

const app = express();

// Configure CORS: For development, allow all. For production, restrict to your frontend's domain.
// Example: app.use(cors({ origin: 'https://your-frontend-domain.com' }));
app.use(cors()); 
app.use(express.json());

// This environment variable will be linked to your Secret Manager secret
const API_KEY = process.env.GEMINI_API_KEY_SECRET; 

if (!API_KEY) {
  console.error("FATAL ERROR: GEMINI_API_KEY_SECRET environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const modelName = 'gemini-2.5-flash';

app.post('/', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "API key not configured on the server." });
  }

  try {
    const { prompt, systemInstruction } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required in the request body.' });
    }
    
    const contents = prompt; 

    let generationConfig = {};
    if (systemInstruction) {
      generationConfig.systemInstruction = systemInstruction;
    }

    const result = await ai.models.generateContent({ 
        model: modelName,
        contents: contents,
        ...(Object.keys(generationConfig).length > 0 && { config: generationConfig })
    });
    
    const textResponse = result.text; 
    res.status(200).json({ text: textResponse });

  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    res.status(500).json({ error: 'Failed to process request with AI model.', details: error.message });
  }
});

exports.handleGeminiRequest = app;
</code></pre>
        <p><em>Note: The entry point in the GCP console should be <code>handleGeminiRequest</code>. For 2nd gen Cloud Functions using Express, the framework handles starting the server.</em></p>
        </li>
        <li><strong>Runtime Environment Variables (Linking Secret Manager):</strong>
            <ul>
                <li>Scroll to "Runtime, build and connections settings". Expand "Runtime".</li>
                <li>Under "Runtime environment variables", click "Add variable".</li>
                <li><strong>Name:</strong> <code>GEMINI_API_KEY_SECRET</code> (must match what's used in <code>index.js</code>).</li>
                <li><strong>Value:</strong> Click "Reference a secret".
                    <ul>
                        <li><strong>Secret:</strong> Select the secret you created (e.g., <code>gemini-api-key</code>).</li>
                        <li><strong>Version:</strong> Select "latest".</li>
                        <li>Click "Done".</li>
                    </ul>
                </li>
            </ul>
        </li>
        <li><strong>Service Account Permissions for Secret Access:</strong>
            <ul>
                <li>The Cloud Function runs as a specific service account. This account needs permission to read the secret.</li>
                <li>During function creation or by editing it later, find the "Runtime service account".</li>
                <li>Go to "IAM & Admin" > "IAM" in the GCP console.</li>
                <li>Find this service account. Click the pencil (edit) icon, then "Add another role".</li>
                <li>Select the role "<strong>Secret Manager Secret Accessor</strong>". Save.</li>
            </ul>
        </li>
        <li>Click "<strong>Deploy</strong>". Wait for deployment to complete.</li>
        <li>Once deployed, go to the "<strong>Trigger</strong>" tab of your function. Copy the <strong>Trigger URL</strong>. This is what your frontend will call.</li>
      </ol>
    `
  },
  {
    title: "CORS Configuration for Your Backend",
    content: `
      <h2>What is CORS?</h2>
      <p>Cross-Origin Resource Sharing is a security feature that restricts web pages from making requests to a different domain than the one that served the page. If your frontend (e.g., <code>your-app.firebaseapp.com</code>) and your backend Cloud Function (<code>...cloudfunctions.net</code>) are on different domains, you must explicitly configure CORS on the backend to allow requests from your frontend.</p>
      <h2>How to Configure CORS in Your Node.js Cloud Function</h2>
      <p>The easiest way is to use the <code>cors</code> npm package, which was included in the <code>package.json</code> in the previous step.</p>
      <p>For production, it is critical to restrict access to only your frontend's domain for security.</p>
      <pre><code class="language-javascript">// In your Cloud Function's index.js:
const cors = require('cors');
const app = express();

// --- Production CORS Configuration ---
// Replace 'https://your-frontend-domain.com' with your actual deployed frontend URL.
const allowedOrigins = ['https://your-frontend-domain.com', 'http://localhost:3000']; // Add localhost for local dev
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));

// --- Development CORS (allow all) ---
// app.use(cors()); 

// ... rest of your function (app.use(express.json()), app.post(...), etc.)
</code></pre>
      <p>After updating your <code>index.js</code> with the correct CORS configuration, you must redeploy your Cloud Function for the changes to take effect.</p>
    `
  },
  {
    title: "Frontend Adaptation - Calling Your Backend",
    content: `
      <p>Now, modify your frontend JavaScript (<code>index.tsx</code> or similar) to call your new Cloud Function instead of trying to use the Gemini API SDK directly.</p>
      <p><strong>Remove any direct Gemini SDK initialization and API key handling from your frontend code.</strong></p>
      <pre><code class="language-typescript">// Example: in your index.tsx or a similar frontend file

// IMPORTANT: Replace this with the Trigger URL of your deployed Cloud Function
const YOUR_CLOUD_FUNCTION_URL = 'https_your_region_your_project_id.cloudfunctions.net/gemini-request-handler';

/**
 * Calls your secure backend proxy to interact with the Gemini API.
 * This function includes robust error handling for network and API issues.
 * @param userPromptText The user's prompt to send to the model.
 * @param systemInstructionText Optional system instruction for the model.
 * @returns The text response from the model.
 * @throws An error with a user-friendly message if the call fails.
 */
async function callGeminiViaBackend(userPromptText: string, systemInstructionText?: string): Promise<string> {
  // The 'try' block handles network-level errors (e.g., CORS, DNS, no internet).
  try {
    const response = await fetch(YOUR_CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: userPromptText,
        ...(systemInstructionText && { systemInstruction: systemInstructionText })
      }),
    });

    // The 'if (!response.ok)' block handles HTTP errors from your backend.
    // This means the request was received, but the server responded with an error status (4xx or 5xx).
    if (!response.ok) {
      let errorMessage = \`Backend request failed with status: \${response.status}\`;
      
      // Try to parse a more specific error message from the backend's JSON response.
      try {
        const errorData = await response.json();
        // Use the 'error' or 'details' field from your Cloud Function's error response.
        errorMessage = errorData.error || errorData.details || errorMessage;
      } catch (jsonError) {
        // If the error response isn't valid JSON, use the status text.
        errorMessage = \`\${errorMessage} - \${response.statusText}\`;
      }

      console.error('Error from backend:', errorMessage);
      throw new Error(errorMessage);
    }

    // If the response is OK, parse the successful JSON response.
    const data = await response.json();
    return data.text; // Assumes your backend returns { text: "..." }

  } catch (error) {
    // This 'catch' block will catch:
    // 1. Network errors (e.g., user is offline, DNS issue).
    // 2. CORS errors (if your backend isn't configured correctly).
    // 3. The error thrown from the 'if (!response.ok)' block above.
    console.error('Error calling backend:', error);
    
    // Provide a more user-friendly error message.
    if (error instanceof TypeError) { // Often indicates a network or CORS error
        throw new Error('A network error occurred. Please check your connection or CORS configuration.');
    }
    
    // Re-throw the original error (could be the custom one from the .ok check).
    throw error;
  }
}
</code></pre>
      <h3>Understanding the Error Handling</h3>
      <p>The code above is designed to be robust. Here’s a breakdown of the failure points it handles:</p>
      <ul>
          <li>
              <strong>Network Errors (Outer <code>try...catch</code>):</strong> This is the first line of defense. If the <code>fetch</code> call itself fails, it will be caught here. This commonly happens because of:
              <ul>
                  <li>The user's device is offline.</li>
                  <li>A DNS issue prevents resolving the function's URL.</li>
                  <li>A <strong>CORS error</strong>. If you see a CORS error in your browser console, it means your backend did not send the correct headers to allow your frontend's domain to make a request. You must fix this in your Cloud Function's CORS configuration.</li>
              </ul>
          </li>
          <li>
              <strong>Backend/API Errors (<code>if (!response.ok)</code>):</strong> This block runs when the network request succeeds, but your backend responds with an HTTP error status code (like 400, 403, 500).
              <ul>
                  <li><code>400 Bad Request</code>: Often means your frontend sent an invalid request (e.g., missing the 'prompt' field in the JSON body).</li>
                  <li><code>403 Forbidden</code>: Could indicate an issue with your Cloud Function's permissions or an API Gateway key if you've set one up.</li>
                  <li><code>500 Internal Server Error</code>: This usually means there's a problem in your Cloud Function's code. For example, it couldn't access the secret, the Gemini API key is invalid, or an unhandled exception occurred. <strong>Check your Cloud Function's logs in the Google Cloud Console to debug this.</strong></li>
              </ul>
          </li>
      </ul>
      <p>Make sure your UI can catch these thrown errors and display a friendly message to the user, like "Sorry, something went wrong. Please try again."</p>
    `
  },
  {
    title: "Frontend Build Process",
    content: `
      <p>For a production web app, your TypeScript (<code>.tsx</code>) code needs to be compiled and bundled into plain JavaScript, HTML, and CSS that browsers can understand.</p>
      <h3>Popular Build Tools:</h3>
      <ul>
        <li><strong>Vite:</strong> Modern, extremely fast, and provides a great developer experience. Highly recommended for new projects.</li>
        <li><strong>Next.js / Nuxt.js / SvelteKit:</strong> Frameworks with built-in build tooling for React, Vue, and Svelte respectively.</li>
        <li><strong>esbuild:</strong> An extremely fast bundler and minifier, often used within other tools like Vite.</li>
      </ul>
      <h3>Example using <code>esbuild</code> (Simple Case):</h3>
      <ol>
        <li>Install esbuild as a development dependency: <code>npm install --save-dev esbuild</code></li>
        <li>Add a build script to your <code>package.json</code>:
<pre><code class="language-json">{
  "scripts": {
    "build": "esbuild index.tsx --bundle --outfile=dist/bundle.js --minify --sourcemap --format=esm --jsx=automatic"
  }
}</code></pre>
        </li>
        <li>Run the build command: <code>npm run build</code></li>
        <li>This creates a <code>dist</code> folder. Your <code>index.html</code> should be updated to load the bundled file:
<pre><code class="language-html">&lt;!DOCTYPE html&gt;
&lt;html&gt;
&lt;head&gt;&lt;title&gt;My App&lt;/title&gt;&lt;/head&gt;
&lt;body&gt;
    &lt;div id="app-container"&gt;&lt;/div&gt;
    &lt;script type="module" src="dist/bundle.js"&gt;&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>
        </li>
      </ol>
    `
  },
  {
    title: "Hosting Your Frontend",
    content: `
      <p>Once your frontend is built into a set of static files (e.g., in a <code>dist</code> or <code>build</code> directory), you need to host it on a public server.</p>
      <h2>Option A: Firebase Hosting (Recommended)</h2>
      <p>Firebase Hosting is an excellent choice for static and dynamic web apps, offering a global CDN, free SSL certificates, and easy setup.</p>
      <ol>
        <li><strong>Set up a Firebase Project:</strong> Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">Firebase Console</a> and add a project (you can link it to your existing Google Cloud project).</li>
        <li><strong>Install Firebase CLI:</strong> If you don't have it, run <code>npm install -g firebase-tools</code>.</li>
        <li><strong>Login and Initialize:</strong> Run <code>firebase login</code> to authenticate. In your project's root directory, run <code>firebase init hosting</code>.
            <ul>
                <li>Follow the prompts. When asked for your public directory, enter the name of your build output folder (e.g., <code>dist</code>).</li>
                <li>Configure as a single-page app if you are using client-side routing.</li>
            </ul>
        </li>
        <li><strong>Build your frontend:</strong> Run your build script (e.g., <code>npm run build</code>).</li>
        <li><strong>Deploy:</strong> Run <code>firebase deploy --only hosting</code>. Your site will be live!</li>
      </ol>
      <h2>Option B: Google Cloud Storage (GCS) + Load Balancer</h2>
      <p>This is a more advanced but powerful option. It involves creating a GCS bucket to hold your static assets, making the bucket public, and setting up a Global HTTP(S) Load Balancer to point to it and provide an SSL certificate.</p>
    `
  },
  {
    title: "Authentication (Conceptual Overview)",
    content: `
      <p>If your application needs to identify users, save personal data, or restrict access to certain features, you need an authentication system.</p>
      <h2>Options:</h2>
      <ul>
        <li><strong>Firebase Authentication:</strong> The easiest and most recommended way for most applications. It's simple to integrate, supports numerous providers (Google, GitHub, Email/Password, etc.), and handles the entire user lifecycle securely.</li>
        <li><strong>Google Identity Platform:</strong> A more enterprise-focused version of Firebase Authentication, built on Google Cloud.</li>
        <li><strong>Auth0, Supabase Auth, etc.:</strong> Excellent third-party services that can simplify authentication.</li>
      </ul>
      <h2>General Workflow (Token-Based):</h2>
      <ol>
        <li><strong>Frontend:</strong> User signs in using a login form/button. Firebase Auth (or another service) returns an ID Token (JWT) to the client upon success.</li>
        <li><strong>Frontend:</strong> For every request to your secure backend (Cloud Function), this ID Token is included in the <code>Authorization</code> header (e.g., <code>Authorization: Bearer &lt;ID_TOKEN&gt;</code>).</li>
        <li><strong>Backend:</strong> Your Cloud Function receives the request, extracts the ID Token, and uses a library (like the Firebase Admin SDK) to verify its signature and expiration. If valid, it processes the request. If not, it returns a 401 Unauthorized error.</li>
      </ol>
    `
  },
  {
    title: "Storage / Database (Conceptual Overview)",
    content: `
      <p>Most non-trivial applications need to store data, such as user profiles, content, or application state.</p>
      <h2>Options (GCP/Firebase):</h2>
      <ul>
        <li><strong>NoSQL (Recommended for Flexibility):</strong>
            <ul>
                <li><strong>Cloud Firestore:</strong> A highly scalable, flexible NoSQL document database. Excellent for a wide variety of applications, with powerful querying and real-time listeners.</li>
                <li><strong>Firebase Realtime Database:</strong> A JSON-based NoSQL database, great for applications needing very low-latency state synchronization.</li>
            </ul>
        </li>
        <li><strong>SQL (for Relational Data):</strong>
            <ul>
                 <li><strong>Cloud SQL:</strong> A fully managed service for MySQL, PostgreSQL, and SQL Server. Use this if your data is highly structured and relational.</li>
            </ul>
        </li>
        <li><strong>Object Storage (for Files):</strong>
            <ul>
                <li><strong>Cloud Storage for Firebase:</strong> The best way to store user-generated content like images, videos, and other files. It's secure and integrates easily with Firebase/GCP.</li>
            </ul>
        </li>
      </ul>
      <p><strong>Security Model:</strong> All database operations should be controlled by your secure backend or through strong security rules (like Firestore Security Rules) to prevent unauthorized data access from the client-side.</p>
    `
  },
  {
    title: "Web Application Testing Strategies",
    content: `
      <h2>Why Test Your Application?</h2>
      <p>Testing is a critical part of the software development lifecycle. It ensures your application is reliable, functions as expected, and provides a good user experience. A solid testing strategy catches bugs early, simplifies maintenance, and gives you confidence when deploying new features.</p>
      
      <h3>1. Unit Testing</h3>
      <ul>
        <li><strong>What it is:</strong> Testing the smallest individual parts (units) of your code in isolation, such as a single function or component.</li>
        <li><strong>Goal:</strong> To verify that each piece of your code works correctly on its own.</li>
        <li><strong>When to use:</strong> Continuously during development. This should form the largest part of your testing suite.</li>
        <li><strong>Recommended Tools:</strong> <a href="https://jestjs.io/" target="_blank" rel="noopener noreferrer">Jest</a>, <a href="https://vitest.dev/" target="_blank" rel="noopener noreferrer">Vitest</a>, <a href="https://mochajs.org/" target="_blank" rel="noopener noreferrer">Mocha</a>.</li>
      </ul>

      <h3>2. Integration Testing</h3>
      <ul>
        <li><strong>What it is:</strong> Testing how multiple units work together as a group. For example, testing if a login form component correctly calls your authentication service.</li>
        <li><strong>Goal:</strong> To find issues in the interactions between different parts of your application.</li>
        <li><strong>When to use:</strong> After unit tests for the individual parts are passing.</li>
        <li><strong>Recommended Tools:</strong> <a href="https://testing-library.com/" target="_blank" rel="noopener noreferrer">React Testing Library</a> (for components), Jest, Vitest.</li>
      </ul>

      <h3>3. End-to-End (E2E) Testing</h3>
      <ul>
        <li><strong>What it is:</strong> Testing the entire application flow from start to finish, simulating real user scenarios in a browser.</li>
        <li><strong>Goal:</strong> To validate the complete workflow and ensure the integrated system works as expected from the user's perspective.</li>
        <li><strong>When to use:</strong> Less frequently than unit/integration tests, often as part of a pre-deployment (CI/CD) pipeline.</li>
        <li><strong>Recommended Tools:</strong> <a href="https://www.cypress.io/" target="_blank" rel="noopener noreferrer">Cypress</a>, <a href="https://playwright.dev/" target="_blank" rel="noopener noreferrer">Playwright</a>.</li>
      </ul>
      
      <h3>4. Performance Testing</h3>
       <ul>
        <li><strong>What it is:</strong> Automatically assessing the performance of your frontend, checking metrics like load speed, responsiveness, and accessibility.</li>
        <li><strong>Goal:</strong> To ensure your application is fast, efficient, and accessible to all users.</li>
        <li><strong>When to use:</strong> Regularly, especially before and after major changes, to prevent performance regressions.</li>
        <li><strong>Recommended Tools:</strong> <a href="https://developer.chrome.com/docs/lighthouse/overview" target="_blank" rel="noopener noreferrer">Google Lighthouse</a> (built into Chrome DevTools), <a href="https://www.webpagetest.org/" target="_blank" rel="noopener noreferrer">WebPageTest</a>.</li>
      </ul>
    `
  },
  {
    title: "CI/CD - Continuous Integration/Deployment (Conceptual)",
    content: `
      <p>CI/CD is the practice of automating your development and deployment workflows to release software faster and more reliably.</p>
      <h3>What is it?</h3>
      <ul>
        <li><strong>Continuous Integration (CI):</strong> Automatically building and testing your code every time a change is pushed to your repository (e.g., GitHub, GitLab). This catches bugs early.</li>
        <li><strong>Continuous Deployment (CD):</strong> Automatically deploying your application to a hosting environment (e.g., Firebase Hosting, Cloud Functions) after it passes the CI stage.</li>
      </ul>
      <h3>Why use it?</h3>
      <ul>
        <li><strong>Speed:</strong> Go from code commit to live deployment in minutes.</li>
        <li><strong>Reliability:</strong> Automated testing reduces the risk of shipping bugs.</li>
        <li><strong>Consistency:</strong> The deployment process is the same every time, reducing human error.</li>
      </ul>
      <h3>Tools:</h3>
      <ul>
        <li><strong>GitHub Actions:</strong> A very popular and powerful CI/CD tool integrated directly into GitHub. You can create workflows to build, test, and deploy to GCP/Firebase.</li>
        <li><strong>Google Cloud Build:</strong> Google Cloud's native CI/CD service. It can be triggered by code pushes to repositories and can deploy to any service on GCP.</li>
        <li><strong>GitLab CI/CD, Jenkins:</strong> Other powerful and popular CI/CD tools.</li>
      </ul>
    `
  },
  {
    title: "Monitoring, Logging & Analytics (Conceptual)",
    content: `
      <p>Once your app is live, it's crucial to observe its health, track errors, and understand how users are interacting with it.</p>
      <h3>Key Areas:</h3>
      <ul>
        <li><strong>Monitoring (Health):</strong>
          <ul>
             <li><strong>Tool:</strong> Google Cloud Monitoring</li>
             <li><strong>Purpose:</strong> Track performance metrics like server response times, CPU usage of your Cloud Functions, and API error rates. Set up alerts to be notified when something goes wrong.</li>
          </ul>
        </li>
        <li><strong>Logging (Debugging):</strong>
           <ul>
             <li><strong>Tool:</strong> Google Cloud Logging (also known as Logs Explorer)</li>
             <li><strong>Purpose:</strong> View detailed logs from your Cloud Functions (e.g., using <code>console.log</code>) and other services to debug issues that happen in production.</li>
          </ul>
        </li>
        <li><strong>Error Tracking (Bugs):</strong>
           <ul>
             <li><strong>Tool:</strong> Sentry, LogRocket, Firebase Crashlytics (for mobile)</li>
             <li><strong>Purpose:</strong> Capture and aggregate frontend JavaScript errors and backend exceptions, providing detailed stack traces and context to help you fix bugs faster.</li>
          </ul>
        </li>
        <li><strong>User Analytics (Behavior):</strong>
           <ul>
             <li><strong>Tool:</strong> Google Analytics 4 (GA4)</li>
             <li><strong>Purpose:</strong> Understand user behavior: where they come from, which features they use most, and where they drop off. This is essential for improving your product.</li>
          </ul>
        </li>
      </ul>
    `
  }
].map(item => ({
    ...item,
    chatHistory: [],
    isChatLoading: false,
    chatError: null,
    currentChatQuery: '',
    suggestedStep: null,
}));


// --- AI Launchpad Types and State ---
type CardType = 'step' | 'decision' | 'option-best' | 'option-other' | 'warning';
type AppView = 'launchpad' | 'guide' | 'tools';
type ProjectInputMode = 'describe' | 'url' | 'code';

interface SubStep {
  id: string; // e.g., cardId-sub-0
  instruction: string;
  completed: boolean;
}

interface ChatMessage {
  id: string; // e.g., cardId-chat-msg-0
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface DetailedCardData {
  id: string;
  title: string;
  type: CardType;
  content: string; // HTML content, to be sanitized or carefully generated
  completed: boolean;
  decisionContextId?: string; // For option cards, links to the parent decision card ID
  activatedByOptionId?: string; // For step/decision cards, this card is only relevant if the specified option ID is chosen

  // For step-by-step breakdown
  subSteps?: SubStep[];
  isBreakingDown?: boolean;
  breakdownError?: string | null;

  // For in-card chat
  chatHistory?: ChatMessage[];
  isChatLoading?: boolean;
  chatError?: string | null;
  currentChatQuery?: string; // Bound to the chat input field for this card
  suggestedStep?: { title: string; type: CardType; content: string; } | null;
  chatChips?: string[];

  // For collapsible decision cards
  isExpanded?: boolean;

  // For Cloud Console prompt generation
  isGeneratingCloudPrompt?: boolean;
  generatedCloudPrompt?: string | null;
  cloudPromptError?: string | null;
}

interface SandboxState {
    html: string;
    css: string;
    js: string;
}

interface SandboxCode {
    html: string;
    css: string;
    js: string;
}


interface ApplicationState {
    projectDescription: string;
    projectUrl: string;
    projectCode: string;
    inputMode: ProjectInputMode;
    roadmapSteps: RoadmapStep[];
    detailedCards: DetailedCardData[];
    completedDetailedCards: DetailedCardData[];
    archivedCards: DetailedCardData[];
    selectedOptionForDecision: { [decisionCardId: string]: string | null };
    sandboxState: SandboxState;
}


interface RoadmapStep {
  id: string; // Corresponds to the generated card ID
  title: string;
  type: CardType;
  completed: boolean;
  relatedCardId: string; // ID of the detailed card this roadmap step links to
  isArchived?: boolean;
  activatedByOptionId?: string;
}

interface ToolState {
    [toolTitle: string]: {
        input: string;
        output: string;
        isLoading: boolean;
        error: string | null;
        useProjectContext: boolean;
    }
}


let currentView: AppView = 'launchpad';
let projectInputMode: ProjectInputMode = 'describe';
let currentProjectUrl: string = "";
let currentProjectCode: string = "";
let currentProjectDescription: string = "";
let roadmapSteps: RoadmapStep[] = [];
let detailedCards: DetailedCardData[] = [];
let completedDetailedCards: DetailedCardData[] = [];
let archivedCards: DetailedCardData[] = [];
let selectedOptionForDecision: { [decisionCardId: string]: string | null } = {};
let guideSearchQuery = '';
let launchpadSearchQuery = '';
let toolStates: ToolState = {};
let sandboxState: SandboxState = {
    html: `<h1>Hello, Sandbox!</h1>\n<p>Edit the code above and click "Run" to see your changes.</p>`,
    css: `body {\n  font-family: sans-serif;\n  color: #333;\n  background-color: #f4f4f4;\n  padding: 1em;\n}`,
    js: `const p = document.querySelector('p');\np.textContent += ' The JavaScript is working!';\nconsole.log("Sandbox JavaScript is running!");`
};


// State for the new clarification phase
let isClarifying = false;
let clarificationChatHistory: ChatMessage[] = [];
let isClarificationLoading = false;
let currentClarificationQuery = "";

// State for Undo functionality
let undoState: ApplicationState | null = null;
let toastTimeoutId: number | null = null;

let isLoadingAiResponse = false;
let globalAiError: string | null = null;

const API_KEY = process.env.API_KEY;
let ai: GoogleGenAI | null = null;
declare var hljs: any;


if (API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    globalAiError = "Failed to initialize AI. API Key might be invalid or not configured correctly.";
  }
} else {
  console.warn("API_KEY environment variable not found. AI Launchpad functionality will be limited or disabled.");
}


// --- DOM Elements ---
const appContainer = document.getElementById('app-container') as HTMLElement;
const loadingOverlay = document.getElementById('loading-overlay') as HTMLElement;
const navLaunchpad = document.getElementById('nav-launchpad') as HTMLAnchorElement;
const navGuide = document.getElementById('nav-guide') as HTMLAnchorElement;
const navTools = document.getElementById('nav-tools') as HTMLAnchorElement;
const headerContent = document.querySelector('.header-content');

// --- Helper Functions ---
function generateUniqueId(prefix: string = 'id'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function sanitizeHtml(htmlString: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString; 

    Array.from(tempDiv.getElementsByTagName('script')).forEach(script => script.remove());
    Array.from(tempDiv.querySelectorAll('*')).forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.toLowerCase().startsWith('on')) {
                el.removeAttribute(attr.name);
            }
            if (attr.name.toLowerCase() === 'href' && attr.value.toLowerCase().startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });
    return tempDiv.innerHTML;
}
function stripHtml(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
}


function findCardGlobally(cardId: string): DetailedCardData | undefined {
    return detailedCards.find(c => c.id === cardId) ||
           completedDetailedCards.find(c => c.id === cardId) ||
           archivedCards.find(c => c.id === cardId);
}

function findStaticCard(cardId: string): StaticGuideCardData | undefined {
    let found: StaticGuideCardData | undefined;
    
    function search(cards: StaticGuideCardData[]) {
        for (const card of cards) {
            if (card.title.replace(/\s+/g, '-') === cardId) {
                found = card;
                return;
            }
            if (card.children) {
                search(card.children);
                if (found) return;
            }
        }
    }
    
    search(staticGuideData);
    return found;
}


function archiveGivenCard(cardToArchive: DetailedCardData, sourceList: DetailedCardData[] = detailedCards) {
    const indexInSource = sourceList.findIndex(c => c.id === cardToArchive.id);
    if (indexInSource > -1) {
        sourceList.splice(indexInSource, 1);
    }
    const indexInCompleted = completedDetailedCards.findIndex(c => c.id === cardToArchive.id);
    if (indexInCompleted > -1) {
        completedDetailedCards.splice(indexInCompleted, 1);
    }

    if (!archivedCards.find(c => c.id === cardToArchive.id)) {
        archivedCards.push(cardToArchive);
    }
    const roadmapItem = roadmapSteps.find(rs => rs.relatedCardId === cardToArchive.id);
    if (roadmapItem) {
        roadmapItem.isArchived = true;
        roadmapItem.completed = false;
    }
    cardToArchive.completed = false;
}


function unarchiveGivenCard(cardToUnarchive: DetailedCardData) {
    const index = archivedCards.findIndex(c => c.id === cardToUnarchive.id);
    if (index > -1) {
        archivedCards.splice(index, 1);
        if (!detailedCards.find(c => c.id === cardToUnarchive.id) && !completedDetailedCards.find(c => c.id === cardToUnarchive.id)) { 
            detailedCards.push(cardToUnarchive); 
        }
        detailedCards.sort((a,b) => {
            const indexA = roadmapSteps.findIndex(rs => rs.id === a.id);
            const indexB = roadmapSteps.findIndex(rs => rs.id === b.id);
            return indexA - indexB;
        });
        const roadmapItem = roadmapSteps.find(rs => rs.relatedCardId === cardToUnarchive.id);
        if (roadmapItem) {
            roadmapItem.isArchived = false;
        }
    }
}


// --- Undo Functionality ---
function deepCloneState(): ApplicationState {
    return JSON.parse(JSON.stringify({
        projectDescription: currentProjectDescription,
        projectUrl: currentProjectUrl,
        projectCode: currentProjectCode,
        inputMode: projectInputMode,
        roadmapSteps,
        detailedCards,
        completedDetailedCards,
        archivedCards,
        selectedOptionForDecision,
        sandboxState,
    }));
}

function saveUndoState() {
    undoState = deepCloneState();
}

function performUndo() {
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    const toast = document.getElementById('undo-toast');
    if (toast) toast.classList.remove('show');

    if (undoState) {
        currentProjectDescription = undoState.projectDescription;
        currentProjectUrl = undoState.projectUrl;
        currentProjectCode = undoState.projectCode;
        projectInputMode = undoState.inputMode;
        roadmapSteps = undoState.roadmapSteps;
        detailedCards = undoState.detailedCards;
        completedDetailedCards = undoState.completedDetailedCards;
        archivedCards = undoState.archivedCards;
        selectedOptionForDecision = undoState.selectedOptionForDecision;
        sandboxState = undoState.sandboxState;
        undoState = null;
        updateView();
    }
}

function showUndoToast(message: string) {
    const toast = document.getElementById('undo-toast') as HTMLElement;
    if (!toast) return;

    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
    }

    toast.innerHTML = `
        <span>${message}</span>
        <button id="undo-btn">Undo</button>
    `;
    const undoBtn = toast.querySelector('#undo-btn');
    undoBtn?.addEventListener('click', performUndo, { once: true });

    toast.classList.add('show');

    toastTimeoutId = window.setTimeout(() => {
        toast.classList.remove('show');
        toastTimeoutId = null;
    }, 6000);
}

// --- State Persistence ---
function saveStateToLocalStorage() {
    try {
        const state: ApplicationState = {
            projectDescription: currentProjectDescription,
            projectUrl: currentProjectUrl,
            projectCode: currentProjectCode,
            inputMode: projectInputMode,
            roadmapSteps,
            detailedCards,
            completedDetailedCards,
            archivedCards,
            selectedOptionForDecision,
            sandboxState,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error("Could not save state to local storage:", error);
    }
}

function loadStateFromLocalStorage() {
    try {
        const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedStateJSON) {
            const loadedState: ApplicationState = JSON.parse(savedStateJSON);

            if (loadedState && loadedState.roadmapSteps && loadedState.detailedCards) {
                currentProjectDescription = loadedState.projectDescription || "";
                currentProjectUrl = loadedState.projectUrl || "";
                currentProjectCode = loadedState.projectCode || "";
                projectInputMode = loadedState.inputMode || 'describe';
                roadmapSteps = loadedState.roadmapSteps;
                detailedCards = loadedState.detailedCards;
                completedDetailedCards = loadedState.completedDetailedCards || [];
                archivedCards = loadedState.archivedCards || [];
                selectedOptionForDecision = loadedState.selectedOptionForDecision || {};
                sandboxState = loadedState.sandboxState || {
                    html: `<h1>Hello, Sandbox!</h1>\n<p>Edit the code above and click "Run" to see your changes.</p>`,
                    css: `body {\n  font-family: sans-serif;\n  color: #333;\n  background-color: #f4f4f4;\n  padding: 1em;\n}`,
                    js: `const p = document.querySelector('p');\np.textContent += ' The JavaScript is working!';\nconsole.log("Sandbox JavaScript is running!");`
                };


                // Sanitize loaded data to prevent errors with older state structures
                [...detailedCards, ...completedDetailedCards, ...archivedCards].forEach(card => {
                    if (card.subSteps === undefined) card.subSteps = [];
                    if (card.chatHistory === undefined) card.chatHistory = [];
                    if (card.currentChatQuery === undefined) card.currentChatQuery = "";
                    if (card.isBreakingDown === undefined) card.isBreakingDown = false;
                    if (card.breakdownError === undefined) card.breakdownError = null;
                    if (card.isChatLoading === undefined) card.isChatLoading = false;
                    if (card.chatError === undefined) card.chatError = null;
                    if (card.activatedByOptionId === undefined) card.activatedByOptionId = undefined;
                    if (card.isExpanded === undefined) {
                        card.isExpanded = !(card.type === 'decision' && detailedCards.includes(card));
                    }
                    if (card.isGeneratingCloudPrompt === undefined) card.isGeneratingCloudPrompt = false;
                    if (card.generatedCloudPrompt === undefined) card.generatedCloudPrompt = null;
                    if (card.cloudPromptError === undefined) card.cloudPromptError = null;
                    if (card.suggestedStep === undefined) card.suggestedStep = null;
                    if (card.chatChips === undefined) {
                        let chips = DEFAULT_CHAT_CHIPS;
                        if (card.title === "Reassessment & Plan Adjustment") {
                             const devToolsCard = staticGuideData.find(c => c.title === "Lifecycle & Strategy");
                             const reassessmentStaticData = devToolsCard?.children?.find(c => c.title === "Reassessment & Plan Adjustment");
                            if (reassessmentStaticData?.chatChips) {
                                chips = reassessmentStaticData.chatChips;
                            }
                        }
                        card.chatChips = chips;
                    }
                });
                roadmapSteps.forEach(rs => {
                    if(rs.activatedByOptionId === undefined) rs.activatedByOptionId = undefined;
                    if(rs.isArchived === undefined) rs.isArchived = false;
                });
            }
        }
    } catch (error) {
        console.error("Could not load state from local storage:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted state
    }
}


// --- Rendering Functions ---

function renderLaunchpad() {
    appContainer.innerHTML = `
        <div class="welcome-container">
            <div class="welcome-content">
                <h1>Welcome to the AI Studio Launch Assistant</h1>
                <p>Your comprehensive guide to launching and deploying AI-powered applications.</p>
            </div>
        </div>
        <div class="launchpad-layout">
            <div class="launchpad-main-content">
                <section class="launchpad-section" id="project-input-section" aria-labelledby="project-input-heading">
                    <h2 id="project-input-heading">1. Describe Your AI Studio Project</h2>
                     <div class="input-mode-tabs" role="tablist" aria-labelledby="project-input-heading">
                        <button id="tab-describe" class="tab-btn ${projectInputMode === 'describe' ? 'active' : ''}" data-mode="describe" role="tab" aria-selected="${projectInputMode === 'describe'}" aria-controls="describe-content">Describe</button>
                        <button id="tab-url" class="tab-btn ${projectInputMode === 'url' ? 'active' : ''}" data-mode="url" role="tab" aria-selected="${projectInputMode === 'url'}" aria-controls="url-content">From URL</button>
                        <button id="tab-code" class="tab-btn ${projectInputMode === 'code' ? 'active' : ''}" data-mode="code" role="tab" aria-selected="${projectInputMode === 'code'}" aria-controls="code-content">From Code</button>
                    </div>
                    <form id="project-description-form">
                        <div id="describe-content" style="display: ${projectInputMode === 'describe' ? 'block' : 'none'};" role="tabpanel" aria-labelledby="tab-describe">
                            <label for="project-description" class="sr-only">Project Description</label>
                            <textarea id="project-description" name="project-description" placeholder="E.g., 'A chatbot for customer service that uses a specific knowledge base about electronics', 'An image generator for creating fantasy art', 'A simple game where the AI is the opponent'..." ${projectInputMode === 'describe' ? 'required' : ''} rows="5" aria-required="${projectInputMode === 'describe'}">${currentProjectDescription}</textarea>
                        </div>
                         <div id="url-content" style="display: ${projectInputMode === 'url' ? 'block' : 'none'};" role="tabpanel" aria-labelledby="tab-url">
                            <label for="project-url" class="sr-only">Project Website URL</label>
                            <input type="url" id="project-url" name="project-url" placeholder="https://example.com" value="${currentProjectUrl}" ${projectInputMode === 'url' ? 'required' : ''} aria-required="${projectInputMode === 'url'}" />
                        </div>
                        <div id="code-content" style="display: ${projectInputMode === 'code' ? 'block' : 'none'};" role="tabpanel" aria-labelledby="tab-code">
                            <label for="project-code" class="sr-only">Paste Your Code</label>
                            <textarea id="project-code" name="project-code" placeholder="Paste your relevant code here (e.g., main component, server file)..." ${projectInputMode === 'code' ? 'required' : ''} rows="10" aria-required="${projectInputMode === 'code'}">${currentProjectCode}</textarea>
                        </div>
                        <div class="form-actions">
                             <button type="submit" id="generate-plan-btn">${isClarifying ? 'Start Over' : 'Analyze & Discuss'}</button>
                            <label for="upload-plan-input" class="button-like-label action-btn" role="button" tabindex="0" aria-controls="upload-plan-input">Upload Plan (.json)</label>
                            <input type="file" id="upload-plan-input" accept=".json" class="sr-only">
                        </div>
                    </form>
                    <div id="global-ai-error-message" class="error-message" style="display: ${globalAiError ? 'block' : 'none'};" role="alert" aria-live="assertive">${globalAiError || ''}</div>
                </section>
                
                <section id="clarification-section" class="launchpad-section" style="display: ${isClarifying ? 'block' : 'none'};" aria-labelledby="clarification-heading">
                    <h2 id="clarification-heading">2. Confirm Project Scope</h2>
                    <div class="clarification-chat-container">
                        <div class="chat-history">
                            ${(clarificationChatHistory || []).map(msg => `
                                <div class="chat-message ${msg.sender}">
                                    <strong>${msg.sender === 'user' ? 'You' : 'AI'}:</strong> ${sanitizeHtml(marked.parse(msg.text) as string)}
                                </div>
                            `).join('')}
                        </div>
                        ${isClarificationLoading ? '<div class="card-loading small-spinner">AI is thinking...</div>' : ''}
                        <form id="clarification-chat-form" class="in-card-chat-form">
                            <label for="clarification-chat-input" class="sr-only">Respond to AI</label>
                            <textarea id="clarification-chat-input" class="chat-input" placeholder="Your response..." rows="2" aria-label="Respond to AI to clarify project details">${currentClarificationQuery}</textarea>
                            <button type="submit" class="action-btn ask-ai-btn" ${isClarificationLoading ? 'disabled' : ''}>Send</button>
                        </form>
                    </div>
                    <div class="clarification-actions">
                        <button id="generate-plan-from-convo-btn" class="action-btn" ${isClarificationLoading || clarificationChatHistory.length < 1 ? 'disabled' : ''}>Looks Good, Generate Plan</button>
                    </div>
                </section>

                <section class="launchpad-section" id="roadmap-section" aria-labelledby="roadmap-heading" style="display: ${!isClarifying && roadmapSteps.length > 0 ? 'block' : 'none'};">
                    <h2 id="roadmap-heading">${isClarifying ? '3.' : '2.'} Your AI-Generated Launch Roadmap</h2>
                    <div id="roadmap-overview" role="navigation" aria-label="Roadmap steps">
                        ${renderRoadmapOverview()}
                    </div>
                </section>

                <section class="launchpad-section" id="detailed-steps-section" aria-labelledby="detailed-steps-heading" style="display: ${!isClarifying && (detailedCards.length > 0 || completedDetailedCards.length > 0 || archivedCards.length > 0) ? 'block' : 'none'};">
                    <h2 id="detailed-steps-heading">${isClarifying ? '4.' : '3.'} Detailed Steps & Guidance</h2>
                    <div id="launchpad-search-container">
                        <label for="launchpad-search-input" class="sr-only">Search Steps</label>
                        <input type="search" id="launchpad-search-input" placeholder="Search steps..." value="${launchpadSearchQuery}">
                    </div>
                    <div id="detailed-cards-container">
                        ${ renderFilteredCards(detailedCards, 'active') }
                    </div>
                </section>

                <section class="launchpad-section" id="completed-roadmap-section" aria-labelledby="completed-roadmap-heading" style="display: ${!isClarifying && completedDetailedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="completed-roadmap-heading">Completed Steps</h2>
                    <div id="completed-cards-container">
                        ${ renderFilteredCards(completedDetailedCards, 'completed') }
                    </div>
                </section>

                <section class="launchpad-section" id="archived-items-section" aria-labelledby="archived-items-heading" style="display: ${!isClarifying && archivedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="archived-items-heading">Archived Items</h2>
                    <div id="archived-cards-container">
                        ${ renderFilteredCards(archivedCards, 'archived') }
                    </div>
                </section>
            </div>
            <aside class="launchpad-sidebar">
                <section id="roadmap-minimap-section" class="launchpad-section sidebar-section" aria-labelledby="roadmap-minimap-heading">
                    <h3 id="roadmap-minimap-heading">Roadmap Minimap</h3>
                    <div id="roadmap-minimap-content">
                        ${renderRoadmapMinimap()}
                    </div>
                </section>
                <section id="decisions-made-section" class="launchpad-section sidebar-section" aria-labelledby="decisions-made-heading">
                    <h3 id="decisions-made-heading">Decisions Made</h3>
                    <div id="decisions-made-content">
                        ${renderDecisionsMadeSidebar()}
                    </div>
                </section>
                <section id="color-legend-section" class="launchpad-section sidebar-section" aria-labelledby="color-legend-heading">
                    <h3 id="color-legend-heading">Legend</h3>
                    <div id="color-legend-content">
                        ${renderColorLegend()}
                    </div>
                </section>
                 <section id="plan-actions-section" class="launchpad-section sidebar-section" aria-labelledby="plan-actions-heading">
                    <h3 id="plan-actions-heading">Plan Actions</h3>
                    <div id="plan-actions-content" class="form-actions" style="flex-direction: column; align-items: stretch;">
                        <button id="download-plan-btn" class="action-btn" ${roadmapSteps.length === 0 ? 'disabled' : ''}>Download Plan (.json)</button>
                    </div>
                </section>
            </aside>
        </div>
    `;
    attachAllEventListeners();

    if (globalAiError && !API_KEY) {
        const generateBtn = document.getElementById('generate-plan-btn') as HTMLButtonElement;
        if(generateBtn) generateBtn.disabled = true;
        const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
        if(errorDiv && !errorDiv.textContent) {
             errorDiv.textContent = "AI features are disabled. API_KEY is not configured.";
             errorDiv.style.display = "block";
        }
    }
    const projectDescTextarea = document.getElementById('project-description') as HTMLTextAreaElement;
    if (projectDescTextarea && currentProjectDescription) {
        projectDescTextarea.value = currentProjectDescription;
    }
    const projectUrlInput = document.getElementById('project-url') as HTMLInputElement;
    if (projectUrlInput && currentProjectUrl) {
        projectUrlInput.value = currentProjectUrl;
    }
     const projectCodeTextarea = document.getElementById('project-code') as HTMLTextAreaElement;
    if (projectCodeTextarea && currentProjectCode) {
        projectCodeTextarea.value = currentProjectCode;
    }
}

function renderFilteredCards(cards: DetailedCardData[], context: 'active' | 'completed' | 'archived'): string {
    const query = launchpadSearchQuery.toLowerCase().trim();
    const filteredCards = query === ''
        ? cards
        : cards.filter(card =>
            card.title.toLowerCase().includes(query) ||
            stripHtml(card.content).toLowerCase().includes(query)
        );

    if (filteredCards.length > 0) {
        return filteredCards.map(card => renderDetailedCard(card, context)).join('');
    } else {
        const contextMessage = context === 'active' ? 'active steps' : `${context} items`;
        return `<p class="empty-state-message">No ${contextMessage} found for your search.</p>`;
    }
}

function renderRoadmapOverview(): string {
    let html = '';
    const processedStepIds = new Set<string>();

    const allCardsMap = new Map<string, DetailedCardData>();
    [...detailedCards, ...completedDetailedCards, ...archivedCards].forEach(c => allCardsMap.set(c.id, c));

    const isVisible = (card: DetailedCardData | undefined): boolean => {
        if (!card) return false;
        if (card.activatedByOptionId) {
            const activatingOptionCard = allCardsMap.get(card.activatedByOptionId);
            const decisionContextId = activatingOptionCard?.decisionContextId;
            // Hide if its path is explicitly ruled out by a different choice
            if (decisionContextId && selectedOptionForDecision[decisionContextId] && selectedOptionForDecision[decisionContextId] !== card.activatedByOptionId) {
                return false;
            }
        }
        return true;
    };

    roadmapSteps.forEach(step => {
        if (processedStepIds.has(step.id) || step.isArchived) return;

        const currentCard = allCardsMap.get(step.relatedCardId);
        if (!isVisible(currentCard)) return;

        // Render only top-level items in the main loop (decisions or steps not activated by an option)
        if (step.type === 'decision') {
            html += `<div class="roadmap-group">`;
            html += `<div class="roadmap-decision-row">${renderMiniCard(step)}</div>`;
            processedStepIds.add(step.id);
            
            const optionSteps = roadmapSteps.filter(rs => {
                const detailCard = allCardsMap.get(rs.relatedCardId);
                return detailCard && 
                       (detailCard.type === 'option-best' || detailCard.type === 'option-other') && 
                       detailCard.decisionContextId === step.relatedCardId && 
                       !rs.isArchived;
            });

            if (optionSteps.length > 0) {
                html += `<div class="roadmap-options-row">`;
                optionSteps.forEach(optStep => {
                    const optCard = allCardsMap.get(optStep.relatedCardId);
                    if (!isVisible(optCard)) return;

                    html += `<div class="roadmap-option-with-children">`;
                    html += renderMiniCard(optStep);
                    processedStepIds.add(optStep.id);

                    const subsequentSteps = roadmapSteps.filter(s => {
                         const card = allCardsMap.get(s.relatedCardId);
                         return card?.activatedByOptionId === optStep.relatedCardId && !s.isArchived && isVisible(card);
                    });

                    if (subsequentSteps.length > 0) {
                        html += `<div class="roadmap-subsequent-steps">`;
                        subsequentSteps.forEach(subStep => {
                            html += renderMiniCard(subStep);
                            processedStepIds.add(subStep.id);
                        });
                        html += `</div>`;
                    }
                    html += `</div>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
        } else if (currentCard && !currentCard.decisionContextId && !currentCard.activatedByOptionId) {
             html += `<div class="roadmap-group single-step">${renderMiniCard(step)}</div>`;
             processedStepIds.add(step.id);
        }
    });

    if (html.trim() === '') {
      return '<p class="empty-state-message">No roadmap steps to display. Generate or load a plan.</p>';
    }
    return html;
}



function renderMiniCard(step: RoadmapStep, isInnerOption: boolean = false, isSelected: boolean = false): string {
    let extraClass = '';
    if (step.completed) extraClass += ' completed';
    if (step.isArchived) extraClass += ' archived';
    if (isInnerOption) extraClass += ' inner-option-minicard';
    if (isSelected) extraClass += ' selected';
    
    const detailedCard = findCardGlobally(step.relatedCardId);
    let title = step.title;
    if (detailedCard && detailedCard.type !== 'decision' && detailedCard.decisionContextId) {
        const parentDecision = findCardGlobally(detailedCard.decisionContextId);
        if (parentDecision && parentDecision.completed && selectedOptionForDecision[parentDecision.id] !== step.relatedCardId) {
             extraClass += ' archived';
        }
    }


    return `
        <div class="mini-card type-${step.type} ${extraClass}" data-scroll-to="card-${step.relatedCardId}" role="button" tabindex="0" aria-label="Scroll to ${step.title}">
            ${title}
        </div>
    `;
}


function renderDetailedCard(card: DetailedCardData, context: 'active' | 'completed' | 'archived'): string {
    let cardContentHtml = card.content;
    if (!card.content.trim().match(/^<\w+/) && card.content.includes('\n')) {
        try {
            cardContentHtml = marked.parse(card.content) as string;
        } catch (e) {
            console.error("Markdown parsing error for card:", card.id, e);
            cardContentHtml = sanitizeHtml(card.content.replace(/\n/g, '<br>'));
        }
    } else {
        cardContentHtml = sanitizeHtml(card.content);
    }

    let dependencyInfoHtml = '';
    if (card.activatedByOptionId) {
        const parentOption = findCardGlobally(card.activatedByOptionId);
        if (parentOption) {
            dependencyInfoHtml = `<p class="dependency-info">Depends on: <strong>${sanitizeHtml(parentOption.title)}</strong></p>`;
        }
    }

    let activatesInfoHtml = '';
    if (card.type === 'option-best' || card.type === 'option-other') {
        const allCards = [...detailedCards, ...completedDetailedCards, ...archivedCards];
        const activatedCards = allCards.filter(c => c.activatedByOptionId === card.id);

        if (activatedCards.length > 0) {
            activatesInfoHtml = `
                <div class="activates-info">
                    <h4>Activates the following:</h4>
                    <ul class="activates-list">
                        ${activatedCards.map(c => `<li>${sanitizeHtml(c.title)}</li>`).join('')}
                    </ul>
                </div>`;
        }
    }

    const mainTaskCompleted = context === 'archived' ? false : card.completed;
    const cardClasses = `detailed-card type-${card.type} ${mainTaskCompleted ? 'completed-style' : ''} context-${context}`;
    const isDecisionCard = card.type === 'decision';
    const isExpanded = card.isExpanded === undefined ? (isDecisionCard && context === 'active' ? false : true) : card.isExpanded;


    let decisionOptionsHtml = '';
    if (isDecisionCard && context === 'active') {
        const optionCards = [...detailedCards, ...completedDetailedCards, ...archivedCards].filter(
            optCard => (optCard.type === 'option-best' || optCard.type === 'option-other') && optCard.decisionContextId === card.id && !archivedCards.includes(optCard)
        ).sort((a, b) => (a.type === 'option-best' ? -1 : 1));

        if (optionCards.length > 0) {
            decisionOptionsHtml = `
                <div class="decision-options-container">
                    <h4>Options for this decision:</h4>
                    <div class="decision-options-minicards">
                        ${optionCards.map(optCard => {
                const correspondingRoadmapStep = roadmapSteps.find(rs => rs.relatedCardId === optCard.id);
                const isSelected = selectedOptionForDecision[card.id] === optCard.id;
                return correspondingRoadmapStep ? renderMiniCard(correspondingRoadmapStep, true, isSelected) : '';
            }).join('')}
                    </div>
                </div>`;
        }
    }
    
    let subStepsHtml = '';
    if (card.subSteps && card.subSteps.length > 0) {
        subStepsHtml = `
            <div class="sub-steps-container">
                <h5>Actionable Sub-steps:</h5>
                <ul class="sub-step-list" id="sub-steps-${card.id}">
                    ${card.subSteps.map(subStep => `
                        <li class="sub-step-item ${subStep.completed ? 'completed' : ''}" data-substep-id="${subStep.id}">
                           <input type="checkbox" id="checkbox-${subStep.id}" ${subStep.completed ? 'checked' : ''} aria-labelledby="label-${subStep.id}">
                           <label for="checkbox-${subStep.id}" id="label-${subStep.id}">${sanitizeHtml(subStep.instruction)}</label>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    let chatHtml = '';
    // Chat is available on all active cards that are not tools
    const associatedStaticCard = staticGuideData.find(d => d.title === card.title);
    if (context === 'active' || (associatedStaticCard && !associatedStaticCard.isTool)) {
         let chatChipsHtml = '';
         if (card.chatChips && card.chatChips.length > 0) {
             chatChipsHtml = `
                 <div class="chat-chips-container">
                     ${card.chatChips.map(chipText => `
                         <button class="chat-chip" data-card-id="${card.id}">${sanitizeHtml(chipText)}</button>
                     `).join('')}
                 </div>
             `;
         }

         chatHtml = `
        <div class="in-card-chat-container">
             <h5>Need Help? Ask AI</h5>
             <div class="chat-history" id="chat-history-${card.id}">
                 ${(card.chatHistory || []).map(msg => `
                    <div class="chat-message ${msg.sender}">
                       <strong>${msg.sender === 'user' ? 'You' : 'AI'}:</strong> ${sanitizeHtml(marked.parse(msg.text) as string)}
                    </div>
                 `).join('')}
             </div>
             ${card.isChatLoading ? '<div class="card-loading small-spinner">AI is thinking...</div>' : ''}
             ${card.chatError ? `<div class="error-message">${card.chatError}</div>` : ''}
              ${card.suggestedStep ? `
                <div class="suggested-step-preview">
                    <h5>AI Suggestion: Add New Step</h5>
                    <div class="suggested-step-preview-content">
                        <strong>Title:</strong> ${sanitizeHtml(card.suggestedStep.title)}<br>
                        <strong>Type:</strong> ${sanitizeHtml(card.suggestedStep.type)}<br>
                        <p>${sanitizeHtml(card.suggestedStep.content)}</p>
                    </div>
                    <button id="add-suggested-step-btn-${card.id}" data-card-id="${card.id}" class="action-btn">Add to Plan</button>
                </div>
            ` : ''}
             ${chatChipsHtml}
             <form class="in-card-chat-form" id="chat-form-${card.id}" data-card-id="${card.id}">
                <label for="chat-input-${card.id}" class="sr-only">Ask AI about this step</label>
                <textarea id="chat-input-${card.id}" class="chat-input" placeholder="Ask for clarification, examples, etc." rows="1" ${card.isChatLoading ? 'disabled' : ''}>${card.currentChatQuery || ''}</textarea>
                <button type="submit" class="action-btn ask-ai-btn" ${card.isChatLoading ? 'disabled' : ''}>Ask</button>
             </form>
        </div>`;
    }

    let cloudPromptGeneratorHtml = '';
    // Show on specific card types that are active
    const showCloudPromptGenerator = context === 'active' && 
                                      (card.title.toLowerCase().includes('google cloud') || 
                                       card.title.toLowerCase().includes('backend') ||
                                       card.title.toLowerCase().includes('database'));
    if (showCloudPromptGenerator) {
        cloudPromptGeneratorHtml = `
            <div class="cloud-prompt-generator">
                <h5>Gemini in Cloud Prompt</h5>
                <p>Generate a prompt for Gemini in Cloud to help with this step. It will use your project description as context.</p>
                 ${card.isGeneratingCloudPrompt ? '<div class="card-loading small-spinner">Generating prompt...</div>' : ''}
                 ${card.cloudPromptError ? `<div class="error-message">${card.cloudPromptError}</div>` : ''}
                 ${card.generatedCloudPrompt ? `
                    <div class="generated-cloud-prompt-container">
                        <h5>Generated Prompt:</h5>
                        <div class="code-block-wrapper">
                            <pre><code class="language-plaintext">${card.generatedCloudPrompt}</code></pre>
                            <button class="copy-code-btn" data-copy-text="${encodeURIComponent(card.generatedCloudPrompt)}">Copy</button>
                        </div>
                    </div>
                 ` : ''}
                <button class="action-btn generate-cloud-prompt-btn" data-card-id="${card.id}" ${card.isGeneratingCloudPrompt ? 'disabled' : ''}>
                    ${card.generatedCloudPrompt ? 'Regenerate Prompt' : 'Generate Prompt'}
                </button>
            </div>
        `;
    }

    let cardFooterHtml = '';
    if (context === 'active') {
        if (!isDecisionCard) {
            const isPending = card.subSteps && card.subSteps.length > 0 && !card.completed;
            cardFooterHtml = `
                <div class="card-footer">
                     <button class="action-btn" data-card-id="${card.id}" data-action="archive">Archive</button>
                     <button class="complete-btn ${isPending ? 'pending-btn' : ''}" data-card-id="${card.id}" data-action="complete">
                        ${isPending ? 'Complete All & Mark Done' : 'Mark as Complete'}
                    </button>
                </div>`;
        } else {
            cardFooterHtml = `
                 <div class="card-footer">
                    <p class="decision-footer-note">Make a selection from the options above to proceed.</p>
                     <button class="action-btn" data-card-id="${card.id}" data-action="archive">Archive Decision</button>
                </div>
            `;
        }
    } else if (context === 'completed') {
        cardFooterHtml = `
            <div class="card-footer">
                 <button class="action-btn" data-card-id="${card.id}" data-action="archive">Archive</button>
                 <button class="action-btn" data-card-id="${card.id}" data-action="reopen">Re-open Step</button>
            </div>`;
    } else if (context === 'archived') {
         cardFooterHtml = `
            <div class="card-footer">
                 <button class="action-btn" data-card-id="${card.id}" data-action="unarchive">Unarchive</button>
            </div>`;
    }
    
    return `
        <div class="${cardClasses}" id="card-${card.id}" data-card-id="${card.id}">
            <div class="detailed-card-header ${isDecisionCard ? 'clickable' : ''}" data-card-id="${card.id}" data-action="toggle-expand">
                <span class="card-title">${card.title}</span>
                ${isDecisionCard ? `<span class="card-toggle-icon">${isExpanded ? '▼' : '▶'}</span>` : ''}
            </div>
            <div class="card-content-wrapper ${isExpanded ? '' : 'collapsed'}">
                <div class="card-content">
                    ${dependencyInfoHtml}
                    ${cardContentHtml}
                    ${activatesInfoHtml}
                    ${decisionOptionsHtml}
                    ${subStepsHtml}
                    ${card.isBreakingDown ? '<div class="card-loading small-spinner">Breaking down into sub-steps...</div>' : ''}
                    ${card.breakdownError ? `<div class="error-message">${card.breakdownError}</div>` : ''}
                    ${(!card.subSteps || card.subSteps.length === 0) && !isDecisionCard && context === 'active' && !card.isBreakingDown ?
                        `<button class="action-btn breakdown-btn" data-card-id="${card.id}">Break Down into Sub-steps</button>` : ''
                    }
                    ${chatHtml}
                    ${cloudPromptGeneratorHtml}
                </div>
                ${cardFooterHtml}
            </div>
        </div>
    `;
}

function renderMinimapNode(step: RoadmapStep, level: number = 0): string {
    let extraClass = '';
    if (step.completed) extraClass += ' completed';
    if (step.isArchived) extraClass += ' archived';

    const detailedCard = findCardGlobally(step.relatedCardId);
    if (detailedCard && detailedCard.type !== 'decision' && detailedCard.decisionContextId) {
        const parentDecision = findCardGlobally(detailedCard.decisionContextId);
        if (parentDecision && parentDecision.completed && selectedOptionForDecision[parentDecision.id] !== step.relatedCardId) {
             extraClass += ' archived';
        }
    }

    const firstActiveCard = detailedCards.length > 0 ? detailedCards[0] : null;
    if (firstActiveCard && firstActiveCard.id === step.relatedCardId) {
        extraClass += ' current-step';
    }

    return `
        <div class="minimap-node type-${step.type} ${extraClass}" data-scroll-to="card-${step.relatedCardId}" style="--level: ${level};" role="button" tabindex="0" aria-label="Scroll to ${step.title}">
            <span class="minimap-node-indicator"></span>
            <span class="minimap-node-title">${step.title}</span>
        </div>
    `;
}

function renderRoadmapMinimap(): string {
    if (roadmapSteps.length === 0) {
        return '<p class="empty-state-message">No roadmap to display.</p>';
    }

    let html = '<div class="minimap-tree">';
    const processedStepIds = new Set<string>();

    const allCardsMap = new Map<string, DetailedCardData>();
    [...detailedCards, ...completedDetailedCards, ...archivedCards].forEach(c => allCardsMap.set(c.id, c));

    const isVisible = (card: DetailedCardData | undefined): boolean => {
        if (!card) return false;
        if (card.activatedByOptionId) {
            const activatingOptionCard = allCardsMap.get(card.activatedByOptionId);
            const decisionContextId = activatingOptionCard?.decisionContextId;
            if (decisionContextId && selectedOptionForDecision[decisionContextId] && selectedOptionForDecision[decisionContextId] !== card.activatedByOptionId) {
                return false;
            }
        }
        return true;
    };

    function buildLevel(steps: RoadmapStep[], level: number) {
        steps.forEach(step => {
            if (processedStepIds.has(step.id) || step.isArchived) return;

            const currentCard = allCardsMap.get(step.relatedCardId);
            if (!isVisible(currentCard)) return;

            processedStepIds.add(step.id);
            html += renderMinimapNode(step, level);

            if (step.type === 'decision') {
                const optionSteps = roadmapSteps.filter(rs => {
                    const detailCard = allCardsMap.get(rs.relatedCardId);
                    return detailCard && (detailCard.type === 'option-best' || detailCard.type === 'option-other') && detailCard.decisionContextId === step.relatedCardId;
                });

                if (optionSteps.length > 0) {
                    html += '<div class="minimap-branch">';
                    optionSteps.forEach(optStep => {
                        const subsequentSteps = roadmapSteps.filter(s => {
                            const card = allCardsMap.get(s.relatedCardId);
                            return card?.activatedByOptionId === optStep.relatedCardId;
                        });
                        if (subsequentSteps.length > 0) {
                            html += '<div class="minimap-branch-option">';
                            buildLevel([optStep, ...subsequentSteps], level + 1);
                            html += '</div>';
                        } else {
                            buildLevel([optStep], level + 1);
                        }
                    });
                    html += '</div>';
                }
            }
        });
    }

    const topLevelSteps = roadmapSteps.filter(step => {
        const card = allCardsMap.get(step.relatedCardId);
        return card && !card.activatedByOptionId;
    });

    buildLevel(topLevelSteps, 0);

    html += '</div>';
    return html;
}

function renderDecisionsMadeSidebar(): string {
    const decisions = Object.keys(selectedOptionForDecision)
        .map(decisionId => {
            const optionId = selectedOptionForDecision[decisionId];
            const decisionCard = findCardGlobally(decisionId);
            const optionCard = optionId ? findCardGlobally(optionId) : null;
            if (decisionCard && optionCard) {
                return { decision: decisionCard, option: optionCard };
            }
            return null;
        })
        .filter(d => d !== null) as { decision: DetailedCardData, option: DetailedCardData }[];

    if (decisions.length === 0) {
        return '<p class="empty-state-message">No decisions have been made yet.</p>';
    }

    return `
        <ul class="decisions-made-list">
            ${decisions.map(d => `
                <li class="decision-made-item">
                    <span class="decision-title">${sanitizeHtml(d.decision.title)}</span>
                    <span class="chosen-option">${sanitizeHtml(d.option.title)}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

function renderColorLegend(): string {
    return `
        <ul class="color-legend-list">
            <li class="legend-item"><span class="legend-swatch type-step"></span> Step / Action Item</li>
            <li class="legend-item"><span class="legend-swatch type-decision"></span> Decision Required</li>
            <li class="legend-item"><span class="legend-swatch type-option-best"></span> Recommended Option</li>
            <li class="legend-item"><span class="legend-swatch type-option-other"></span> Alternative Option</li>
            <li class="legend-item"><span class="legend-swatch type-warning"></span> Warning / Critical Note</li>
            <li class="legend-item"><span class="legend-swatch completed item-example"></span> Completed Item</li>
            <li class="legend-item"><span class="legend-swatch archived item-example"></span> Archived Item</li>
        </ul>
    `;
}


function renderGuide() {
    const filteredGuideData = guideSearchQuery.trim() === ''
        ? staticGuideData
        : staticGuideData.filter(card => {
            const query = guideSearchQuery.toLowerCase();
            const selfMatch = card.title.toLowerCase().includes(query) ||
                            stripHtml(card.content).toLowerCase().includes(query);
            if (selfMatch) return true;

            const childMatch = card.children?.some(child => 
                child.title.toLowerCase().includes(query) ||
                stripHtml(child.content).toLowerCase().includes(query)
            );
            return !!childMatch;
        });

    appContainer.innerHTML = `
        <h2 class="guide-main-heading">AI Application Deployment Guide</h2>
        <div class="guide-version-info">
            Version: ${GUIDE_VERSION} | Last Updated: ${GUIDE_LAST_UPDATED}
        </div>
         <div id="guide-search-container">
            <label for="guide-search-input" class="sr-only">Search Guide</label>
            <input type="search" id="guide-search-input" placeholder="Search guide sections..." value="${guideSearchQuery}">
        </div>
        <div id="guide-cards-container">
            ${filteredGuideData.length > 0 ? filteredGuideData.map(card => renderStaticGuideCard(card)).join('') : '<p id="no-guide-results">No guide sections found for your search.</p>'}
        </div>
    `;
    attachAllEventListeners();
}

function renderStaticGuideCard(cardData: StaticGuideCardData) {
    const childrenHtml = cardData.children
        ? `<div class="nested-guide-cards">${cardData.children.map(child => renderStaticGuideCard(child)).join('')}</div>`
        : '';
    
    let isOpen = false;
    if (guideSearchQuery.trim() !== '' && cardData.children) {
        const query = guideSearchQuery.toLowerCase();
        const selfMatch = cardData.title.toLowerCase().includes(query) ||
                        stripHtml(cardData.content).toLowerCase().includes(query);
        const childMatch = cardData.children.some(child => 
            child.title.toLowerCase().includes(query) ||
            stripHtml(child.content).toLowerCase().includes(query)
        );
        if (childMatch && !selfMatch) {
            isOpen = true;
        }
    }

    let extraContentHtml = '';
    if (cardData.title === "Reassessment & Plan Adjustment") {
        if (!cardData.chatHistory) cardData.chatHistory = [];
        if (cardData.isChatLoading === undefined) cardData.isChatLoading = false;
        if (cardData.chatError === undefined) cardData.chatError = null;
        if (cardData.currentChatQuery === undefined) cardData.currentChatQuery = '';

        const cardId = cardData.title.replace(/\s+/g, '-');
        
        let chatChipsHtml = '';
        if (cardData.chatChips && cardData.chatChips.length > 0) {
            chatChipsHtml = `
                <div class="chat-chips-container">
                    ${cardData.chatChips.map(chipText => `
                        <button class="chat-chip" data-card-id="${cardId}">${sanitizeHtml(chipText)}</button>
                    `).join('')}
                </div>
            `;
        }


        extraContentHtml = `
            <div class="in-card-chat-container">
                 <div class="chat-history" id="chat-history-${cardId}">
                     ${(cardData.chatHistory || []).map(msg => `
                        <div class="chat-message ${msg.sender}">
                           <strong>${msg.sender === 'user' ? 'You' : 'AI'}:</strong> ${sanitizeHtml(marked.parse(msg.text) as string)}
                        </div>
                     `).join('')}
                 </div>
                 ${cardData.isChatLoading ? '<div class="card-loading small-spinner">AI is thinking...</div>' : ''}
                 ${cardData.chatError ? `<div class="error-message">${cardData.chatError}</div>` : ''}
                 ${chatChipsHtml}
                 <form class="in-card-chat-form" id="chat-form-${cardId}" data-card-id="${cardId}">
                    <label for="chat-input-${cardId}" class="sr-only">Describe your situation</label>
                    <textarea id="chat-input-${cardId}" class="chat-input" placeholder="Describe your situation here..." rows="3" ${cardData.isChatLoading ? 'disabled' : ''}>${cardData.currentChatQuery || ''}</textarea>
                    <button type="submit" class="action-btn ask-ai-btn" ${cardData.isChatLoading ? 'disabled' : ''}>Ask</button>
                 </form>
            </div>`;
    }

    return `
        <details class="guide-card type-step" id="guide-card-${cardData.title.replace(/\s+/g, '-')}" ${isOpen ? 'open' : ''}>
            <summary>
                <span class="card-title">${cardData.title}</span>
            </summary>
            <div class="card-content">
                ${cardData.content}
                ${childrenHtml}
                ${extraContentHtml}
            </div>
        </details>
    `;
}

function renderToolsView() {
    appContainer.innerHTML = `
        <h2 class="guide-main-heading">Developer Tools</h2>
        <div id="tools-container">
            ${toolData.map(card => renderToolCard(card)).join('')}
        </div>
    `;
    attachAllEventListeners();
}

function renderSandboxTool(): string {
    const sandboxToolState = toolStates["Live Code Sandbox"] || { input: '', output: '', isLoading: false, error: null, useProjectContext: false };
    return `
         <div class="sandbox-ai-generator">
            <h4>Build with AI</h4>
            <p>Describe a simple app you want to build (e.g., "a calculator", "a to-do list", "a digital clock"), and the AI will generate the code for you.</p>
            <form id="sandbox-ai-form">
                <label for="sandbox-ai-input" class="sr-only">Describe the app to build</label>
                <textarea id="sandbox-ai-input" class="tool-input" placeholder="e.g., build a simple calculator with add, subtract, multiply, and divide functions" rows="3" ${sandboxToolState.isLoading ? 'disabled' : ''}>${sandboxToolState.input || ''}</textarea>
                <button type="submit" class="action-btn" ${sandboxToolState.isLoading ? 'disabled' : ''}>Generate App</button>
            </form>
            <div id="sandbox-ai-status">
                 ${sandboxToolState.isLoading ? '<div class="card-loading small-spinner">AI is building...</div>' : ''}
                 ${sandboxToolState.error ? `<div class="error-message">${sandboxToolState.error}</div>` : ''}
            </div>
        </div>
        <div class="sandbox-container">
            <div class="sandbox-panes">
                <div class="sandbox-pane">
                    <div class="sandbox-pane-header">
                        <label for="sandbox-html">HTML</label>
                        <button class="copy-code-btn" data-copy-target="sandbox-html" title="Copy HTML code">Copy</button>
                    </div>
                    <textarea id="sandbox-html" class="sandbox-editor" spellcheck="false" aria-label="HTML code editor">${sandboxState.html}</textarea>
                </div>
                <div class="sandbox-pane">
                    <div class="sandbox-pane-header">
                        <label for="sandbox-css">CSS</label>
                        <button class="copy-code-btn" data-copy-target="sandbox-css" title="Copy CSS code">Copy</button>
                    </div>
                    <textarea id="sandbox-css" class="sandbox-editor" spellcheck="false" aria-label="CSS code editor">${sandboxState.css}</textarea>
                </div>
                <div class="sandbox-pane">
                    <div class="sandbox-pane-header">
                        <label for="sandbox-js">JavaScript</label>
                        <button class="copy-code-btn" data-copy-target="sandbox-js" title="Copy JavaScript code">Copy</button>
                    </div>
                    <textarea id="sandbox-js" class="sandbox-editor" spellcheck="false" aria-label="JavaScript code editor">${sandboxState.js}</textarea>
                </div>
            </div>
            <div class="sandbox-controls">
                <button id="use-code-for-plan-btn" class="action-btn info-btn" title="Use the HTML, CSS, and JS below to generate a new plan in the AI Launchpad.">Use Code for Plan</button>
                <button id="run-sandbox-btn" class="action-btn">Run</button>
            </div>
            <div class="sandbox-preview-container">
                <label>Preview</label>
                <iframe id="sandbox-preview" title="Live Code Preview" sandbox="allow-scripts"></iframe>
            </div>
        </div>
    `;
}

function renderFileManagerTool(): string {
    return `
        <div class="file-manager-container">
            <div class="file-upload-local">
                <h4>From Computer</h4>
                <label for="file-upload-input" class="button-like-label action-btn">Select Files</label>
                <input type="file" id="file-upload-input" class="sr-only" multiple>
                <p id="file-upload-count">No files selected.</p>
                <ul id="file-upload-list"></ul>
            </div>
            <div class="file-upload-drive">
                <h4>From Google Drive</h4>
                <button id="connect-drive-btn" class="action-btn">Connect to Google Drive</button>
                <p class="drive-note">This would open the Google Drive Picker in a real application.</p>
            </div>
        </div>
    `;
}


function renderToolCard(cardData: StaticGuideCardData) {
    const toolTitleId = cardData.title.replace(/\s+/g, '-');
    
    if (cardData.title === "Live Code Sandbox") {
        return `
            <section class="guide-card type-step" aria-labelledby="heading-${toolTitleId}">
                <details open>
                    <summary>
                        <span class="card-title">${cardData.title}</span>
                    </summary>
                    <div class="card-content">
                        ${cardData.content}
                        <div class="tool-card-container">
                            ${renderSandboxTool()}
                        </div>
                    </div>
                </details>
            </section>
        `;
    }

    if (cardData.title === "Project File Manager") {
        return `
            <section class="guide-card type-step" aria-labelledby="heading-${toolTitleId}">
                <details>
                     <summary>
                        <span class="card-title">${cardData.title}</span>
                    </summary>
                    <div class="card-content">
                        ${cardData.content}
                        <div class="tool-card-container">
                            ${renderFileManagerTool()}
                        </div>
                    </div>
                </details>
            </section>
        `;
    }
    
    // For regular tools or tools with embedded forms like GitHub Assistant
    const isRegularTool = !["Live Code Sandbox", "Project File Manager", "GitHub Assistant"].includes(cardData.title);

    if (!toolStates[cardData.title]) {
        toolStates[cardData.title] = { input: '', output: '', isLoading: false, error: null, useProjectContext: true };
    }
    const toolState = toolStates[cardData.title];
    let outputHtml = '';
    if (toolState.output) {
        if (cardData.title === "Mermaid Diagram Builder") {
            outputHtml = `<div class="mermaid-diagram" id="mermaid-output-container-${toolTitleId}">${toolState.output}</div>`;
        } else {
             outputHtml = sanitizeHtml(marked.parse(toolState.output) as string);
        }
    }

    const isContextAware = cardData.title === "PRD Generator" || cardData.title === "MVP Feature Scoper";
    const contextCheckboxId = `context-checkbox-${toolTitleId}`;
    const contextCheckboxHtml = isContextAware ? `
        <div class="tool-context-toggle">
            <input type="checkbox" id="${contextCheckboxId}" data-tool-title="${cardData.title}" ${toolState.useProjectContext ? 'checked' : ''} ${roadmapSteps.length === 0 ? 'disabled' : ''}>
            <label for="${contextCheckboxId}">Use Project Context from AI Launchpad</label>
            ${roadmapSteps.length === 0 ? '<span class="context-disabled-note">(Generate a plan in AI Launchpad first)</span>' : ''}
        </div>
    ` : '';
    
    const outputId = `tool-output-${toolTitleId}`;

    return `
        <section class="guide-card type-step" aria-labelledby="heading-${toolTitleId}">
            <details>
                <summary>
                     <span class="card-title">${cardData.title}</span>
                </summary>
                <div class="card-content">
                    ${cardData.content}
                    ${isRegularTool ? `
                    <div class="tool-card-container">
                        <form class="tool-form" data-tool-title="${cardData.title}">
                             <label for="tool-input-${toolTitleId}" class="sr-only">${cardData.title} Input</label>
                             <textarea id="tool-input-${toolTitleId}" class="tool-input" placeholder="Enter your prompt here..." rows="4" ${toolState.isLoading ? 'disabled' : ''} aria-label="${cardData.title} input prompt">${toolState.input}</textarea>
                             ${contextCheckboxHtml}
                             <button type="submit" class="action-btn" ${toolState.isLoading ? 'disabled' : ''} aria-controls="${outputId}" aria-label="Generate ${cardData.title}">Generate</button>
                        </form>
                        <div id="${outputId}" role="status" aria-live="polite">
                            ${toolState.isLoading ? '<div class="card-loading small-spinner">AI is generating...</div>' : ''}
                            ${toolState.error ? `<div class="error-message">${toolState.error}</div>` : ''}
                            ${outputHtml ? `<div class="tool-output-container">${outputHtml}</div>` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </details>
        </section>
    `;
}


function updateView(newView?: AppView) {
    if (newView) {
        currentView = newView;
    }

    navLaunchpad.classList.toggle('active', currentView === 'launchpad');
    navGuide.classList.toggle('active', currentView === 'guide');
    navTools.classList.toggle('active', currentView === 'tools');

    if (currentView === 'launchpad') {
        renderLaunchpad();
    } else if (currentView === 'guide') {
        renderGuide();
    } else {
        renderToolsView();
    }
}

// --- Event Listeners ---
function attachAllEventListeners() {
    // Configure highlight.js to suppress security warnings for trusted content
    hljs.configure({ ignoreUnescapedHTML: true });

    navLaunchpad.addEventListener('click', (e) => { e.preventDefault(); updateView('launchpad'); });
    navGuide.addEventListener('click', (e) => { e.preventDefault(); updateView('guide'); });
    navTools.addEventListener('click', (e) => { e.preventDefault(); updateView('tools'); });
    
    // Scroll to top button
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
    if (scrollToTopBtn) {
        window.onscroll = () => {
            if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        };
        scrollToTopBtn.addEventListener('click', handleScrollToTop);
    }


    if (currentView === 'launchpad') {
        const form = document.getElementById('project-description-form');
        form?.addEventListener('submit', handleProjectFormSubmit);
        
        const clarificationForm = document.getElementById('clarification-chat-form');
        clarificationForm?.addEventListener('submit', handleClarificationSubmit);
        
        const generatePlanFromConvoBtn = document.getElementById('generate-plan-from-convo-btn');
        generatePlanFromConvoBtn?.addEventListener('click', handleGeneratePlanFromConvo);
        
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => tab.addEventListener('click', () => switchInputMode(tab.getAttribute('data-mode') as ProjectInputMode)));

        const uploadInput = document.getElementById('upload-plan-input');
        uploadInput?.addEventListener('change', handleFileUpload);
        
        const downloadBtn = document.getElementById('download-plan-btn');
        downloadBtn?.addEventListener('click', handlePlanDownload);
        
        const launchpadSearchInput = document.getElementById('launchpad-search-input');
        launchpadSearchInput?.addEventListener('input', (e) => {
            launchpadSearchQuery = (e.target as HTMLInputElement).value;
            renderLaunchpad();
        });

        attachCardEventListeners();

    } else if (currentView === 'guide') {
        const searchInput = document.getElementById('guide-search-input');
        searchInput?.addEventListener('input', (e) => {
            guideSearchQuery = (e.target as HTMLInputElement).value;
            renderGuide();
        });
        
        const interactiveChatForms = document.querySelectorAll('.guide-card .in-card-chat-form');
        interactiveChatForms.forEach(form => {
            form.addEventListener('submit', handleCardChatSubmit);
             const textarea = form.querySelector('textarea');
            if(textarea) {
                textarea.addEventListener('input', (e) => {
                    const cardId = form.getAttribute('data-card-id');
                    const card = findStaticCard(cardId || '');
                    if (card) {
                        card.currentChatQuery = (e.target as HTMLTextAreaElement).value;
                    }
                });
            }
        });
        
        const guideContainer = document.getElementById('guide-cards-container');
        guideContainer?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const chatChip = target.closest('.chat-chip');
            if (chatChip) {
                const cardId = chatChip.getAttribute('data-card-id');
                const chipText = chatChip.textContent || '';

                if (cardId) {
                    const card = findStaticCard(cardId);
                    const inputEl = document.getElementById(`chat-input-${cardId}`) as HTMLTextAreaElement;
                    
                    if (card && inputEl) {
                        card.currentChatQuery = chipText;
                        inputEl.value = chipText;
                        inputEl.focus();
                        inputEl.style.height = 'auto';
                        inputEl.style.height = `${inputEl.scrollHeight}px`;
                    }
                }
            }
        });

    } else { // Tools view
        const toolForms = document.querySelectorAll('.tool-form');
        toolForms.forEach(form => {
            form.addEventListener('submit', handleToolSubmit);
        });
        
        document.querySelectorAll('.tool-context-toggle input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const title = target.getAttribute('data-tool-title');
                if (title && toolStates[title]) {
                    toolStates[title].useProjectContext = target.checked;
                }
            });
        });

        // File Manager Listeners
        const fileUploadInput = document.getElementById('file-upload-input');
        if (fileUploadInput) fileUploadInput.addEventListener('change', handleFileSelected);
        const driveBtn = document.getElementById('connect-drive-btn');
        if (driveBtn) driveBtn.addEventListener('click', () => alert("In a real application, this would open the Google Drive Picker to select files."));

        // Sandbox listeners
        const sandboxAiForm = document.getElementById('sandbox-ai-form');
        if (sandboxAiForm) {
            sandboxAiForm.addEventListener('submit', handleSandboxAiRequest);
            const textarea = sandboxAiForm.querySelector('textarea');
            if(textarea) {
                textarea.addEventListener('input', (e) => {
                    const toolTitle = "Live Code Sandbox";
                    if (!toolStates[toolTitle]) {
                        toolStates[toolTitle] = { input: '', output: '', isLoading: false, error: null, useProjectContext: false };
                    }
                    toolStates[toolTitle].input = (e.target as HTMLTextAreaElement).value;
                });
            }
        }

        const sandboxHtml = document.getElementById('sandbox-html') as HTMLTextAreaElement;
        const sandboxCss = document.getElementById('sandbox-css') as HTMLTextAreaElement;
        const sandboxJs = document.getElementById('sandbox-js') as HTMLTextAreaElement;
        const runSandboxBtn = document.getElementById('run-sandbox-btn');
        const useCodeForPlanBtn = document.getElementById('use-code-for-plan-btn');

        if (sandboxHtml) sandboxHtml.addEventListener('input', () => { sandboxState.html = sandboxHtml.value; saveStateToLocalStorage(); });
        if (sandboxCss) sandboxCss.addEventListener('input', () => { sandboxState.css = sandboxCss.value; saveStateToLocalStorage(); });
        if (sandboxJs) sandboxJs.addEventListener('input', () => { sandboxState.js = sandboxJs.value; saveStateToLocalStorage(); });
        if (runSandboxBtn) {
            runSandboxBtn.addEventListener('click', handleRunSandbox);
            // Run initially to show default content
            handleRunSandbox();
        }
        if (useCodeForPlanBtn) {
            useCodeForPlanBtn.addEventListener('click', handleUseSandboxCodeForPlan);
        }
    }
    
    document.querySelectorAll('.copy-code-btn').forEach(button => {
        button.addEventListener('click', () => {
            let textToCopy = '';
            const copyTextAttr = button.getAttribute('data-copy-text');
            const copyTargetAttr = button.getAttribute('data-copy-target');

            if (copyTextAttr) {
                textToCopy = decodeURIComponent(copyTextAttr);
            } else if (copyTargetAttr) {
                const targetElement = document.getElementById(copyTargetAttr) as HTMLTextAreaElement;
                if (targetElement) {
                    textToCopy = targetElement.value;
                }
            }

            if (textToCopy) {
                 navigator.clipboard.writeText(textToCopy).then(() => {
                    button.textContent = 'Copied!';
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.textContent = 'Copy';
                        button.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                });
            }
        });
    });
    
    hljs.highlightAll();
    
    document.querySelectorAll('.mermaid-diagram').forEach((el) => {
        try {
            const id = 'mermaid-svg-' + generateUniqueId();
            mermaid.render(id, el.textContent || '', (svgCode: string) => {
                el.innerHTML = svgCode;
            });
        } catch(e) {
            console.error("Mermaid render error:", e);
            el.innerHTML = `<p class="error-message">Error rendering diagram. Check Mermaid syntax.</p>`;
        }
    });
}

function attachCardEventListeners() {
    // Roadmap mini-cards and minimap nodes for scrolling
    const scrollNodes = document.querySelectorAll('.mini-card, .minimap-node');
    scrollNodes.forEach(node => node.addEventListener('click', () => {
        const targetId = node.getAttribute('data-scroll-to');
        if (targetId) {
            // Check if the click is on a minimap node to provide visual feedback
            if (node.classList.contains('minimap-node')) {
                document.querySelectorAll('.minimap-node').forEach(n => n.classList.remove('selected'));
                node.classList.add('selected');
            }
            scrollToElement(targetId);
        }
    }));

    // Detailed cards actions
    const detailedCardsContainer = document.getElementById('app-container');
    if (detailedCardsContainer) {
        detailedCardsContainer.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;

            // Card Action Buttons (Complete, Archive, etc.)
            const actionButton = target.closest('[data-action]');
            if (actionButton) {
                const cardId = actionButton.closest('.detailed-card')?.getAttribute('data-card-id');
                const action = actionButton.getAttribute('data-action');
                if (cardId) {
                    switch (action) {
                        case 'complete':
                            handleToggleComplete(cardId, 'active');
                            break;
                        case 'reopen':
                            handleToggleComplete(cardId, 'completed');
                            break;
                        case 'archive':
                             const sourceList = actionButton.closest('#completed-cards-container') ? completedDetailedCards : detailedCards;
                            handleArchiveCard(cardId, sourceList);
                            break;
                        case 'unarchive':
                            handleUnarchiveCard(cardId);
                            break;
                        case 'toggle-expand':
                            const card = findCardGlobally(cardId);
                            if (card) {
                                card.isExpanded = !card.isExpanded;
                                updateView();
                            }
                            break;
                    }
                }
            }
            
            // Decision option mini-card selection
             const optionMiniCard = target.closest('.inner-option-minicard');
             if (optionMiniCard) {
                const optionCardId = optionMiniCard.getAttribute('data-scroll-to')?.replace('card-', '');
                const decisionCardId = optionMiniCard.closest('.detailed-card')?.getAttribute('data-card-id');
                if (optionCardId && decisionCardId) {
                    handleOptionSelection(optionCardId, decisionCardId);
                }
             }

            // Breakdown button
            const breakdownBtn = target.closest('.breakdown-btn');
            if (breakdownBtn) {
                const cardId = breakdownBtn.getAttribute('data-card-id');
                if (cardId) handleBreakdown(cardId);
            }
            
            // Add Suggested Step
            if (target.id.startsWith('add-suggested-step-btn-')) {
                const cardId = target.getAttribute('data-card-id');
                if (cardId) handleAddSuggestedStep(cardId);
            }

            // Generate Cloud Prompt
             const genCloudPromptBtn = target.closest('.generate-cloud-prompt-btn');
            if (genCloudPromptBtn) {
                const cardId = genCloudPromptBtn.getAttribute('data-card-id');
                if (cardId) handleGenerateCloudPrompt(cardId);
            }
            
            // Chat Chip Click
            const chatChip = target.closest('.chat-chip');
            if (chatChip) {
                const cardId = chatChip.getAttribute('data-card-id');
                const chipText = chatChip.textContent || '';
                if (cardId) {
                    const card = findCardGlobally(cardId);
                    const inputEl = document.getElementById(`chat-input-${cardId}`) as HTMLTextAreaElement;
                    if (card && inputEl) {
                        card.currentChatQuery = chipText;
                        inputEl.value = chipText;
                        inputEl.focus();
                        // Adjust textarea height
                        inputEl.style.height = 'auto';
                        inputEl.style.height = `${inputEl.scrollHeight}px`;
                    }
                }
            }


        });

        // Sub-step checkbox toggles
        detailedCardsContainer.querySelectorAll('.sub-step-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const subStepId = (e.target as HTMLElement).closest('.sub-step-item')?.getAttribute('data-substep-id');
                const cardId = (e.target as HTMLElement).closest('.detailed-card')?.getAttribute('data-card-id');
                if (subStepId && cardId) {
                    handleSubStepToggle(cardId, subStepId);
                }
            });
        });

        // Chat form submissions
        detailedCardsContainer.querySelectorAll('.detailed-card .in-card-chat-form').forEach(form => {
            form.addEventListener('submit', handleCardChatSubmit);
            // Also update state on input for seamless re-render
            const textarea = form.querySelector('textarea');
            if(textarea) {
                textarea.addEventListener('input', (e) => {
                    const cardId = form.getAttribute('data-card-id');
                    const card = findCardGlobally(cardId || '');
                    if (card) {
                        card.currentChatQuery = (e.target as HTMLTextAreaElement).value;
                    }
                });
            }
        });
    }
}


// --- Event Handlers ---
async function handleProjectFormSubmit(event: Event) {
    event.preventDefault();
    if (isClarifying) { // If it's a "Start Over" button
        isClarifying = false;
        clarificationChatHistory = [];
        roadmapSteps = [];
        detailedCards = [];
        completedDetailedCards = [];
        archivedCards = [];
        selectedOptionForDecision = {};
        updateView();
        return;
    }

    const descriptionTextarea = document.getElementById('project-description') as HTMLTextAreaElement;
    const urlInput = document.getElementById('project-url') as HTMLInputElement;
    const codeTextarea = document.getElementById('project-code') as HTMLTextAreaElement;
    currentProjectDescription = descriptionTextarea.value;
    currentProjectUrl = urlInput.value;
    currentProjectCode = codeTextarea.value;
    
    let userInput = '';
    switch(projectInputMode) {
        case 'describe': userInput = currentProjectDescription; break;
        case 'url': userInput = `URL: ${currentProjectUrl}`; break;
        case 'code': userInput = `CODE:\n\`\`\`\n${currentProjectCode}\n\`\`\``; break;
    }

    if (!userInput.trim()) {
        globalAiError = "Please describe your project before generating a plan.";
        updateView();
        return;
    }

    isClarifying = true;
    isClarificationLoading = true;
    clarificationChatHistory = [{
        id: generateUniqueId('msg'),
        sender: 'user',
        text: `My project idea is: ${userInput}`,
        timestamp: new Date()
    }];
    globalAiError = null;
    updateView(); // Show the clarification chat UI

    try {
        const aiResponse = await callGeminiForClarification(userInput);
        clarificationChatHistory.push({
            id: generateUniqueId('msg'),
            sender: 'ai',
            text: aiResponse,
            timestamp: new Date()
        });
    } catch (error) {
        console.error("Error during clarification:", error);
        globalAiError = (error as Error).message;
    } finally {
        isClarificationLoading = false;
        updateView();
    }
}

async function handleClarificationSubmit(event: Event) {
    event.preventDefault();
    const input = document.getElementById('clarification-chat-input') as HTMLTextAreaElement;
    const userQuery = input.value.trim();
    if (!userQuery || isClarificationLoading) return;
    
    currentClarificationQuery = ''; // Clear input immediately
    clarificationChatHistory.push({
        id: generateUniqueId('msg'),
        sender: 'user',
        text: userQuery,
        timestamp: new Date()
    });
    isClarificationLoading = true;
    updateView();

    const fullConversation = clarificationChatHistory.map(m => `${m.sender}: ${m.text}`).join('\n');
    try {
        const aiResponse = await callGeminiForClarification(fullConversation);
         clarificationChatHistory.push({
            id: generateUniqueId('msg'),
            sender: 'ai',
            text: aiResponse,
            timestamp: new Date()
        });
    } catch (error) {
        console.error("Error during clarification:", error);
        globalAiError = (error as Error).message;
    } finally {
        isClarificationLoading = false;
        updateView();
    }
}

function handleGeneratePlanFromConvo() {
    isClarifying = false;
    const fullConversation = clarificationChatHistory.map(m => `${m.sender}: ${m.text}`).join('\n');
    generatePlan(fullConversation);
}

function switchInputMode(mode: ProjectInputMode) {
    if (projectInputMode === mode) return;
    projectInputMode = mode;
    
    // Reset other input fields
    if (mode === 'describe') {
        currentProjectUrl = "";
        currentProjectCode = "";
    } else if (mode === 'url') {
        currentProjectDescription = "";
        currentProjectCode = "";
    } else { // code
        currentProjectDescription = "";
        currentProjectUrl = "";
    }
    
    updateView();
}


function handleToggleComplete(cardId: string, fromContext: 'active' | 'completed') {
    const cardToMove = (fromContext === 'active' ? detailedCards : completedDetailedCards).find(c => c.id === cardId);
    if (!cardToMove) return;

    saveUndoState();

    const cardElement = document.getElementById(`card-${cardId}`);
    
    if (fromContext === 'active') {
        const index = detailedCards.findIndex(c => c.id === cardId);
        detailedCards.splice(index, 1);
        cardToMove.completed = true;
        // Mark all sub-steps as complete
        if(cardToMove.subSteps) {
            cardToMove.subSteps.forEach(s => s.completed = true);
        }
        completedDetailedCards.unshift(cardToMove);
        showUndoToast(`Step "${cardToMove.title}" completed.`);
    } else { // from 'completed'
        const index = completedDetailedCards.findIndex(c => c.id === cardId);
        completedDetailedCards.splice(index, 1);
        cardToMove.completed = false;
        detailedCards.push(cardToMove);
        detailedCards.sort((a,b) => {
             const indexA = roadmapSteps.findIndex(rs => rs.id === a.id);
             const indexB = roadmapSteps.findIndex(rs => rs.id === b.id);
             return indexA - indexB;
        });
        showUndoToast(`Step "${cardToMove.title}" re-opened.`);
    }

    const roadmapItem = roadmapSteps.find(rs => rs.relatedCardId === cardId);
    if (roadmapItem) {
        roadmapItem.completed = cardToMove.completed;
    }
    
     if (cardElement) {
        cardElement.classList.add('is-completing');
        setTimeout(() => {
            updateView();
            saveStateToLocalStorage();
        }, 400); // Match animation duration
    } else {
        updateView();
        saveStateToLocalStorage();
    }
}

function handleArchiveCard(cardId: string, sourceList: DetailedCardData[]) {
    const card = sourceList.find(c => c.id === cardId);
    if (!card) return;
    saveUndoState();
    archiveGivenCard(card, sourceList);
    updateView();
    saveStateToLocalStorage();
    showUndoToast(`"${card.title}" archived.`);
}

function handleUnarchiveCard(cardId: string) {
    const card = archivedCards.find(c => c.id === cardId);
    if (!card) return;
    saveUndoState();
    unarchiveGivenCard(card);
    updateView();
    saveStateToLocalStorage();
    showUndoToast(`"${card.title}" restored.`);
}

function handleOptionSelection(optionCardId: string, decisionCardId: string) {
    const optionCard = findCardGlobally(optionCardId);
    const decisionCard = findCardGlobally(decisionCardId);
    if (!optionCard || !decisionCard) return;

    saveUndoState();

    selectedOptionForDecision[decisionCardId] = optionCardId;
    decisionCard.completed = true;

    // Move decision card to completed
    const decisionIndex = detailedCards.findIndex(c => c.id === decisionCardId);
    if (decisionIndex > -1) {
        const [decided] = detailedCards.splice(decisionIndex, 1);
        completedDetailedCards.unshift(decided);
    }
    const roadmapItem = roadmapSteps.find(rs => rs.relatedCardId === decisionCardId);
    if (roadmapItem) roadmapItem.completed = true;

    // Archive the other options for this decision
    const allOptions = [...detailedCards, ...completedDetailedCards, ...archivedCards].filter(
        c => c.decisionContextId === decisionCardId && c.id !== optionCardId
    );
    allOptions.forEach(opt => archiveGivenCard(opt, detailedCards));

    updateView();
    saveStateToLocalStorage();
    showUndoToast(`Decision made for "${decisionCard.title}".`);
}

async function handleBreakdown(cardId: string) {
    const card = detailedCards.find(c => c.id === cardId);
    if (!card || card.isBreakingDown) return;

    card.isBreakingDown = true;
    card.breakdownError = null;
    updateView();

    try {
        const response = await callGeminiForBreakdown(card);
        const subStepsList = response.split('\n')
            .map(s => s.trim().replace(/^- \[ \]\s*/, ''))
            .filter(s => s.length > 0);

        card.subSteps = subStepsList.map((instruction, index) => ({
            id: `${cardId}-sub-${index}`,
            instruction,
            completed: false,
        }));
    } catch (error) {
        console.error("Error breaking down step:", error);
        card.breakdownError = "Failed to break down the step. Please try again.";
    } finally {
        card.isBreakingDown = false;
        updateView();
        saveStateToLocalStorage();
    }
}

function handleSubStepToggle(cardId: string, subStepId: string) {
    const card = detailedCards.find(c => c.id === cardId);
    if (!card || !card.subSteps) return;

    const subStep = card.subSteps.find(s => s.id === subStepId);
    if (subStep) {
        subStep.completed = !subStep.completed;
    }
    
    // Check if all sub-steps are now complete
    const allSubStepsComplete = card.subSteps.every(s => s.completed);
    if (allSubStepsComplete) {
        card.completed = true;
    }

    updateView();
    saveStateToLocalStorage();
}


async function handleCardChatSubmit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const cardId = form.getAttribute('data-card-id');
    const card = findCardGlobally(cardId || '') || findStaticCard(cardId || '');
    if (!card) return;

    const input = form.querySelector('textarea') as HTMLTextAreaElement;
    const userQuery = input.value.trim();
    if (!userQuery || card.isChatLoading) return;

    card.currentChatQuery = ''; // Clear input immediately
    if (!card.chatHistory) card.chatHistory = [];
    card.chatHistory.push({
        id: generateUniqueId('msg'),
        sender: 'user',
        text: userQuery,
        timestamp: new Date()
    });
    card.isChatLoading = true;
    card.chatError = null;
    card.suggestedStep = null; // Clear previous suggestion
    updateView();

    try {
        const response = await callGeminiForChat(card, userQuery);
        card.chatHistory.push({
            id: generateUniqueId('msg'),
            sender: 'ai',
            text: response,
            timestamp: new Date()
        });

        // Check if the AI response suggests adding a step
        const addStepRegex = /\[ADD_STEP\]\s*(\{[\s\S]*\})/i;
        const match = response.match(addStepRegex);
        if (match && match[1]) {
            try {
                const stepJson = JSON.parse(match[1]);
                if (stepJson.title && stepJson.type && stepJson.content) {
                    card.suggestedStep = {
                        title: stepJson.title,
                        type: stepJson.type,
                        content: stepJson.content
                    };
                }
            } catch (e) {
                console.error("Failed to parse suggested step JSON:", e);
            }
        }

    } catch (error) {
        console.error("Error in AI chat:", error);
        card.chatError = (error as Error).message;
    } finally {
        card.isChatLoading = false;
        updateView();
        saveStateToLocalStorage();
    }
}

async function handleGenerateCloudPrompt(cardId: string) {
    const card = findCardGlobally(cardId);
    if (!card || card.isGeneratingCloudPrompt) return;

    card.isGeneratingCloudPrompt = true;
    card.cloudPromptError = null;
    card.generatedCloudPrompt = null;
    updateView();

    try {
        const prompt = await callGeminiForCloudPrompt(card);
        card.generatedCloudPrompt = prompt;
    } catch (error) {
        console.error("Error generating cloud prompt:", error);
        card.cloudPromptError = (error as Error).message;
    } finally {
        card.isGeneratingCloudPrompt = false;
        updateView();
        saveStateToLocalStorage();
    }
}

function handleAddSuggestedStep(cardId: string) {
    const card = findCardGlobally(cardId);
    if (!card || !card.suggestedStep) return;

    const { title, type, content } = card.suggestedStep;
    const newCardId = generateUniqueId('card');
    const newCard: DetailedCardData = {
        id: newCardId,
        title,
        type: type as CardType,
        content,
        completed: false,
        subSteps: [],
        chatHistory: [],
        currentChatQuery: '',
        isExpanded: true,
        isBreakingDown: false,
        breakdownError: null,
        isChatLoading: false,
        chatError: null,
        suggestedStep: null,
        isGeneratingCloudPrompt: false,
        generatedCloudPrompt: null,
        cloudPromptError: null,
        chatChips: DEFAULT_CHAT_CHIPS,
    };
    
    const newRoadmapStep: RoadmapStep = {
        id: newCardId,
        title,
        type: type as CardType,
        completed: false,
        relatedCardId: newCardId,
    };

    // Find the index of the current card's roadmap step to insert the new one after it
    const currentRoadmapIndex = roadmapSteps.findIndex(rs => rs.relatedCardId === cardId);
    if (currentRoadmapIndex !== -1) {
        roadmapSteps.splice(currentRoadmapIndex + 1, 0, newRoadmapStep);
        detailedCards.splice(currentRoadmapIndex + 1, 0, newCard);
    } else {
        // Fallback: add to the end
        roadmapSteps.push(newRoadmapStep);
        detailedCards.push(newCard);
    }
    
    card.suggestedStep = null; // Clear the suggestion
    updateView();
    saveStateToLocalStorage();
}


async function handleToolSubmit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const title = form.getAttribute('data-tool-title');
    if (!title) return;
    
    const textarea = form.querySelector('textarea');
    // For PR template, there's no input, so textarea can be null
    const input = textarea ? textarea.value : '';

    if (!toolStates[title]) toolStates[title] = { input: '', output: '', isLoading: false, error: null, useProjectContext: false };
    
    toolStates[title].input = input;
    toolStates[title].isLoading = true;
    toolStates[title].error = null;
    toolStates[title].output = '';
    
    // Since this can be a sub-tool, we need to re-render the whole tools view
    // to show the loading state correctly.
    if (currentView === 'tools') {
         renderToolsView(); // Re-render to show loading spinner
    }


    try {
        let output = '';
        if (title.startsWith("GitHub Assistant:")) {
            const action = title.split(':')[1];
            output = await callGeminiForGitHubTool(action, input);
        } else {
             // Logic for other tools
            let projectContext: string | undefined = undefined;
            if (toolStates[title]?.useProjectContext && roadmapSteps.length > 0) {
                 const activeSteps = detailedCards.map(c => `- ${c.title}`).join('\n');
                const completedSteps = completedDetailedCards.map(c => `- ${c.title} (Completed)`).join('\n');
                const decisions = Object.entries(selectedOptionForDecision).map(([decisionId, optionId]) => {
                    const decisionCard = findCardGlobally(decisionId);
                    const optionCard = findCardGlobally(optionId || '');
                    return `  - For "${decisionCard?.title}", the choice was "${optionCard?.title}"`;
                }).join('\n');

                projectContext = `
        ---
        CURRENT PROJECT CONTEXT:
        Project Description: ${currentProjectDescription}
        Decisions Made:
        ${decisions || '  (None yet)'}
        Active Steps:
        ${activeSteps || '  (None)'}
        Completed Steps:
        ${completedSteps || '  (None)'}
        ---
        `;
            }
             output = await callGeminiForTool(title, input, projectContext);
        }
        toolStates[title].output = output;

    } catch (e) {
        console.error(`Error in ${title} tool:`, e);
        toolStates[title].error = (e as Error).message;
    } finally {
        toolStates[title].isLoading = false;
        // Re-render again to show the final result
         if (currentView === 'tools') {
            renderToolsView();
        }
    }
}

async function handleSandboxAiRequest(event: Event) {
    event.preventDefault();
    const toolTitle = "Live Code Sandbox";
    const inputEl = document.getElementById('sandbox-ai-input') as HTMLTextAreaElement;
    const prompt = inputEl.value;

    if (!toolStates[toolTitle]) {
        toolStates[toolTitle] = { input: '', output: '', isLoading: false, error: null, useProjectContext: false };
    }
    const state = toolStates[toolTitle];
    state.input = prompt;
    state.isLoading = true;
    state.error = null;

    renderToolsView(); // Re-render to show loading spinner

    try {
        const code = await callGeminiForSandbox(prompt);
        
        sandboxState.html = code.html;
        sandboxState.css = code.css;
        sandboxState.js = code.js;
        
    } catch (e) {
        console.error("Error in Sandbox AI:", e);
        state.error = (e as Error).message;
    } finally {
        state.isLoading = false;
        renderToolsView(); // Re-render to show result/error and stop spinner
        
        // After re-rendering with the new code in the textareas, run it.
        setTimeout(handleRunSandbox, 50);
    }
}

function handleFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const countEl = document.getElementById('file-upload-count');
    const listEl = document.getElementById('file-upload-list');

    if (!countEl || !listEl) return;

    if (input.files && input.files.length > 0) {
        countEl.textContent = `${input.files.length} file(s) selected:`;
        let fileListHtml = '';
        for (const file of Array.from(input.files)) {
            fileListHtml += `<li>${sanitizeHtml(file.name)} <span class="file-size">(${(file.size / 1024).toFixed(1)} KB)</span></li>`;
        }
        listEl.innerHTML = fileListHtml;
    } else {
        countEl.textContent = 'No files selected.';
        listEl.innerHTML = '';
    }
}


function scrollToElement(elementId: string) {
    const targetElement = document.getElementById(elementId);
    if (targetElement) {
        // First, ensure the card is expanded if it's a decision card
        const cardId = targetElement.dataset.cardId;
        if(cardId) {
            const card = findCardGlobally(cardId);
            if(card && card.type === 'decision' && !card.isExpanded) {
                card.isExpanded = true;
                updateView();
                // We need to wait for the re-render before scrolling
                setTimeout(() => {
                     const freshElement = document.getElementById(elementId);
                     freshElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50); // Small delay for DOM update
                return;
            }
        }
        
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (file.type !== 'application/json') {
        alert("Please upload a valid .json file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const result = e.target?.result as string;
            const loadedState: ApplicationState = JSON.parse(result);
            if (loadedState && loadedState.roadmapSteps && loadedState.detailedCards) {
                 // Assign loaded state to current state variables
                currentProjectDescription = loadedState.projectDescription || "";
                currentProjectUrl = loadedState.projectUrl || "";
                currentProjectCode = loadedState.projectCode || "";
                projectInputMode = loadedState.inputMode || 'describe';
                roadmapSteps = loadedState.roadmapSteps;
                detailedCards = loadedState.detailedCards;
                completedDetailedCards = loadedState.completedDetailedCards || [];
                archivedCards = loadedState.archivedCards || [];
                selectedOptionForDecision = loadedState.selectedOptionForDecision || {};
                sandboxState = loadedState.sandboxState || sandboxState;
                
                // Reset any transient state
                isClarifying = false;
                clarificationChatHistory = [];

                updateView();
                saveStateToLocalStorage(); // Persist the newly uploaded state
            } else {
                throw new Error("Invalid plan file structure.");
            }
        } catch (error) {
            console.error("Error parsing uploaded file:", error);
            alert("Could not load the plan file. It might be corrupted or in an incorrect format.");
        }
    };
    reader.readAsText(file);
    input.value = ''; // Reset file input
}

function handlePlanDownload() {
    const state: ApplicationState = {
        projectDescription: currentProjectDescription,
        projectUrl: currentProjectUrl,
        projectCode: currentProjectCode,
        inputMode: projectInputMode,
        roadmapSteps,
        detailedCards,
        completedDetailedCards,
        archivedCards,
        selectedOptionForDecision,
        sandboxState,
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "ai_launch_plan.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function handleScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleRunSandbox() {
    const iframe = document.getElementById('sandbox-preview') as HTMLIFrameElement;
    if (!iframe) return;

    const sourceDoc = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>${sandboxState.css}</style>
        </head>
        <body>
            ${sandboxState.html}
            <script>${sandboxState.js}<\/script>
        </body>
        </html>
    `;
    
    iframe.srcdoc = sourceDoc;
    saveStateToLocalStorage(); // Persist changes when code is run
}

function handleUseSandboxCodeForPlan() {
    const combinedCode = `<!-- HTML -->\n${sandboxState.html}\n\n<style>\n/* CSS */\n${sandboxState.css}\n</style>\n\n<script>\n// JavaScript\n${sandboxState.js}<\/script>`;
    
    currentProjectCode = combinedCode;
    projectInputMode = 'code';
    // Clear other input modes' data to avoid confusion
    currentProjectDescription = "";
    currentProjectUrl = "";

    updateView('launchpad');
    
    // After view update, scroll to the input section to show the user where the code went.
    setTimeout(() => {
        document.getElementById('project-input-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}


// --- AI and Logic ---
async function generatePlan(userInput: string) {
    isLoadingAiResponse = true;
    loadingOverlay.style.display = 'flex';
    globalAiError = null;

    try {
        const responseText = await callGeminiForPlan(userInput);
        parseAiResponseToCards(responseText);
    } catch (error) {
        console.error("Error generating plan:", error);
        globalAiError = `Failed to generate plan: ${(error as Error).message}`;
    } finally {
        isLoadingAiResponse = false;
        loadingOverlay.style.display = 'none';
        updateView();
        saveStateToLocalStorage();
    }
}

async function callGeminiForPlan(userInput: string): Promise<string> {
    if (!ai) { throw new Error("AI Client not initialized. Check API Key."); }
    const model = 'gemini-2.5-flash';
    
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
6.  **Clarity and Detail**: The "content" for each card should be clear enough for a junior developer to understand and act upon. Include links to official documentation where helpful.

Example Structure:
{
  "plan": [
    {
      "id": "database-choice",
      "title": "Choose Your Database",
      "type": "decision",
      "content": "<p>Select the database that best fits your project's needs.</p>"
    },
    {
      "id": "option-firestore",
      "title": "Cloud Firestore (NoSQL)",
      "type": "option-best",
      "content": "<p>Recommended for most web apps due to its scalability and flexibility.</p>",
      "decisionContextId": "database-choice"
    },
    {
      "id": "option-cloud-sql",
      "title": "Cloud SQL (Relational)",
      "type": "option-other",
      "content": "<p>Use if your data is highly structured and requires complex queries.</p>",
      "decisionContextId": "database-choice"
    },
    {
      "id": "setup-firestore-rules",
      "title": "Set Up Firestore Security Rules",
      "type": "step",
      "content": "<p>It is critical to secure your Firestore database...</p>",
      "activatedByOptionId": "option-firestore"
    }
  ]
}`;
    
    const prompt = `User's project description: "${userInput}"`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
        }
    });
    return response.text;
}

function parseAiResponseToCards(jsonString: string) {
    try {
        const parsed = JSON.parse(jsonString);
        if (!parsed.plan || !Array.isArray(parsed.plan)) {
            throw new Error("Invalid JSON structure: 'plan' array not found.");
        }

        const newDetailedCards: DetailedCardData[] = parsed.plan.map((item: any) => {
            let chips = DEFAULT_CHAT_CHIPS;
            if (item.title === "Reassessment & Plan Adjustment") {
                 const devToolsCard = staticGuideData.find(c => c.title === "Lifecycle & Strategy");
                 const reassessmentStaticData = devToolsCard?.children?.find(c => c.title === "Reassessment & Plan Adjustment");
                if (reassessmentStaticData?.chatChips) {
                    chips = reassessmentStaticData.chatChips;
                }
            }
            return {
                id: item.id,
                title: item.title,
                type: item.type,
                content: sanitizeHtml(item.content),
                completed: false,
                decisionContextId: item.decisionContextId,
                activatedByOptionId: item.activatedByOptionId,
                subSteps: [],
                isBreakingDown: false,
                breakdownError: null,
                chatHistory: [],
                isChatLoading: false,
                chatError: null,
                currentChatQuery: '',
                isExpanded: item.type !== 'decision',
                suggestedStep: null,
                chatChips: chips,
            };
        });

        const newRoadmapSteps: RoadmapStep[] = newDetailedCards.map(card => ({
            id: card.id,
            title: card.title,
            type: card.type,
            completed: false,
            relatedCardId: card.id,
            activatedByOptionId: card.activatedByOptionId
        }));
        
        roadmapSteps = newRoadmapSteps;
        detailedCards = newDetailedCards.filter(c => c.type !== 'option-best' && c.type !== 'option-other');
        completedDetailedCards = [];
        archivedCards = [];
        selectedOptionForDecision = {};
        
    } catch (error) {
        console.error("Failed to parse AI response:", error);
        console.error("Raw response:", jsonString);
        throw new Error("The AI returned a response in an unexpected format. Please try generating the plan again.");
    }
}

async function callGeminiForChat(card: DetailedCardData | StaticGuideCardData, userQuery: string): Promise<string> {
    if (!ai) throw new Error("AI Client not initialized.");
    
    const cardContentText = stripHtml(card.content);
    const previousChat = (card.chatHistory || []).map(msg => `${msg.sender}: ${msg.text}`).join('\n');
    
    // Check if this is a "Reassessment" chat
    const isReassessment = card.title === "Reassessment & Plan Adjustment";
    let projectContext = '';
    if (isReassessment) {
        const activeSteps = detailedCards.map(c => `- ${c.title}`).join('\n');
        const completedSteps = completedDetailedCards.map(c => `- ${c.title} (Completed)`).join('\n');
        projectContext = `
Here is the current state of the user's project plan:
Project Description: ${currentProjectDescription}
Decisions Made: ${JSON.stringify(selectedOptionForDecision, null, 2)}
Active Steps:
${activeSteps}
Completed Steps:
${completedSteps}
`;
    }

    const systemInstruction = `You are a helpful AI assistant providing guidance on a specific step of a web deployment plan.
The user is asking for help with the step titled "${card.title}".
The content of this step is:
---
${cardContentText}
---
${isReassessment ? projectContext : ''}

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

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: { systemInstruction }
    });

    return response.text;
}


async function callGeminiForBreakdown(card: DetailedCardData): Promise<string> {
    if (!ai) throw new Error("AI Client not initialized.");
    const systemInstruction = `You are a helpful assistant that breaks down a complex task into a series of simple, actionable sub-steps.
The user needs to complete the task: "${card.title}".
The details of the task are:
---
${stripHtml(card.content)}
---
Your response must be a plain text list of sub-steps. Each sub-step must start with "- [ ] ". Do not include any other text or explanation.

Example:
- [ ] First sub-step.
- [ ] Second sub-step.
- [ ] Third sub-step.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Break down the task: "${card.title}"`,
        config: { systemInstruction }
    });
    
    return response.text;
}

async function callGeminiForCloudPrompt(card: DetailedCardData): Promise<string> {
    if (!ai) throw new Error("AI Client not initialized.");
    const systemInstruction = `You are an AI assistant that generates expert-level prompts for Gemini in Google Cloud.
Your goal is to create a prompt that helps a developer accomplish a specific task related to their project.

The user's overall project is: "${currentProjectDescription || 'A web application.'}"
The specific step they are working on is titled: "${card.title}"
The details of this step are:
---
${stripHtml(card.content)}
---
Generate a single, clear, and effective prompt that the user can copy and paste into Gemini in Cloud. The prompt should ask for code, configuration examples, or best practices related to the step, incorporating the context of their project. Do not add any explanation or preamble. Only output the raw prompt text.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Generate the prompt.',
        config: { systemInstruction }
    });
    return response.text;
}

async function callGeminiForTool(toolTitle: string, input: string, projectContext?: string): Promise<string> {
    if (!ai) throw new Error("AI Client not initialized.");
    
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


    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction }
    });
    
    // For mermaid, we need to extract the code from the block
    if (toolTitle === "Mermaid Diagram Builder") {
        const match = response.text.match(/```mermaid\n([\s\S]*?)```/);
        return match ? match[1] : 'graph TD\n  A[Error generating diagram]';
    }
    
    return response.text;
}

async function callGeminiForGitHubTool(action: string, input: string): Promise<string> {
    if (!ai) throw new Error("AI Client not initialized.");
    
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

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction }
    });
    
    return response.text;
}

async function callGeminiForSandbox(prompt: string): Promise<SandboxCode> {
    if (!ai) throw new Error("AI Client not initialized.");
    
    const systemInstruction = `You are an expert frontend web developer. Your task is to generate the complete, self-contained HTML, CSS, and JavaScript code for a simple web application based on a user's prompt.

The output MUST be a single, valid JSON object. Do not include any text, markdown, or code formatting like \`\`\`json before or after the JSON object.

The JSON object must have exactly three keys: "html", "css", and "js".
- The "html" value should be the content for the <body> tag.
- The "css" value should be the full CSS stylesheet.
- The "js" value should be the full JavaScript code.

The generated code must be simple, functional, and not rely on any external libraries or frameworks. Use vanilla JavaScript, HTML, and CSS. The JavaScript should be placed in the 'js' key, not inline in the HTML.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `User prompt: "${prompt}"`,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
        }
    });

    try {
        const parsed = JSON.parse(response.text);
        if (typeof parsed.html === 'string' && typeof parsed.css === 'string' && typeof parsed.js === 'string') {
            return parsed as SandboxCode;
        } else {
            throw new Error("AI response is missing required 'html', 'css', or 'js' keys.");
        }
    } catch (e) {
        console.error("Failed to parse AI response for sandbox:", e);
        console.error("Raw response:", response.text);
        throw new Error("The AI returned code in an unexpected format. Please try a different prompt.");
    }
}


async function callGeminiForClarification(conversationHistory: string): Promise<string> {
    if (!ai) throw new Error("AI Client not initialized.");
    
    const systemInstruction = `You are an AI project planner. A user has given you a project description. Your job is to ask a few (2-3 max) critical, clarifying questions to better understand the project scope before you generate a detailed deployment plan.
Focus on questions that would significantly change the plan, such as:
- The need for user accounts (authentication).
- The type of data to be stored (database choice).
- Any specific technologies they must use.
- The scale of the application (e.g., hobby project vs. enterprise).

Keep your response conversational and end by asking the user to provide more details. Do not generate the plan yet.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: conversationHistory,
        config: { systemInstruction }
    });
    
    return response.text;
}



// --- Initialization ---
function init() {
    loadStateFromLocalStorage();
    updateView('launchpad');
}

init();