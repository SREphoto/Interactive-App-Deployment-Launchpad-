import { StaticGuideCardData, CardType } from './types';

export const GUIDE_VERSION = "1.3.0";
export const GUIDE_LAST_UPDATED = "2024-08-02";
export const LOCAL_STORAGE_KEY = 'aiLaunchpadState_v1_3';

// Default suggested prompts for chat interfaces
export const DEFAULT_CHAT_CHIPS = [
    "Explain this in simpler terms",
    "Give me a code example for this",
    "What are the alternatives to this approach?",
];

export const toolData: StaticGuideCardData[] = [
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

export const staticGuideData: StaticGuideCardData[] = [
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
