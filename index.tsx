/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from "marked";
import { GoogleGenAI } from "@google/genai";
import {
    GUIDE_VERSION,
    GUIDE_LAST_UPDATED,
    LOCAL_STORAGE_KEY,
    DEFAULT_CHAT_CHIPS,
    toolData,
    staticGuideData
} from './src/data';
import {
    CardType,
    AppView,
    ProjectInputMode,
    SubStep,
    ChatMessage,
    DetailedCardData,
    SandboxState,
    RoadmapStep,
    ApplicationState,
    ToolState,
    StaticGuideCardData,
    SandboxCode
} from './src/types';
import { sanitizeHtml, stripHtml, generateUniqueId } from './src/utils';
import {
    initAI,
    callGeminiForPlan,
    callGeminiForClarification,
    callGeminiForChat,
    callGeminiForBreakdown,
    callGeminiForCloudPrompt,
    callGeminiForTool,
    callGeminiForGitHubTool,
    callGeminiForSandbox,
    callGeminiForSandboxEdit
} from './src/api';

declare var hljs: any;

// Removed local declarations to use imported ones.

declare var mermaid: any;

// --- AI Launchpad Types and State ---


const CURRENT_VERSION = "v1.0.0";
const CHANGELOG = [
    {
        version: "v1.0.0",
        date: "2025-12-26",
        changes: [
            "Initial public release",
            "Added AI-powered project planning",
            "Integrated GitHub and Render deployment tools",
            "Implemented Cyberpunk Premium design theme"
        ]
    }
];

// --- Application State ---
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
let launchpadSearchQuery = '';
let filteredGuideData: StaticGuideCardData[] = [];
let guideSearchQuery = '';
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
let isChangelogOpen = false;


const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
declare var hljs: any;


if (API_KEY) {
    try {
        initAI(API_KEY);
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
// const headerContent = document.querySelector('.header-content'); // Removed as per instruction

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
        detailedCards.sort((a, b) => {
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
                    if (rs.activatedByOptionId === undefined) rs.activatedByOptionId = undefined;
                    if (rs.isArchived === undefined) rs.isArchived = false;
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
                        ${renderFilteredCards(detailedCards, 'active')}
                    </div>
                </section>

                <section class="launchpad-section" id="completed-roadmap-section" aria-labelledby="completed-roadmap-heading" style="display: ${!isClarifying && completedDetailedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="completed-roadmap-heading">Completed Steps</h2>
                    <div id="completed-cards-container">
                        ${renderFilteredCards(completedDetailedCards, 'completed')}
                    </div>
                </section>

                <section class="launchpad-section" id="archived-items-section" aria-labelledby="archived-items-heading" style="display: ${!isClarifying && archivedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="archived-items-heading">Archived Items</h2>
                    <div id="archived-cards-container">
                        ${renderFilteredCards(archivedCards, 'archived')}
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
        if (generateBtn) generateBtn.disabled = true;
        const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
        if (errorDiv && !errorDiv.textContent) {
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
        <div class="ide-controls">
            <button class="ide-toggle-btn active" data-pane="chat" title="Toggle Chat">Chat</button>
            <button class="ide-toggle-btn active" data-pane="editor" title="Toggle Code">Code</button>
            <button class="ide-toggle-btn active" data-pane="preview" title="Toggle Preview">Preview</button>
        </div>

        <div class="sandbox-ide-layout">
            <!-- 1. Chat Pane -->
            <div class="ide-pane ide-chat-pane">
                <div class="ide-pane-header">AI Assistant</div>
                <div class="ide-chat-history">
                    <div class="ide-chat-message ai">Hi! Describe your app, and I'll build it. You can then ask me to change specific things!</div>
                    <!-- Chat history would populate here -->
                </div>
                <div class="ide-chat-input-area">
                    <form id="sandbox-we-chat-form">
                        <textarea id="sandbox-ai-input" placeholder="e.g. 'Make the buttons red'..." ${sandboxToolState.isLoading ? 'disabled' : ''}></textarea>
                        <button type="submit" class="action-btn small" style="width: 100%; margin-top: 5px;" ${sandboxToolState.isLoading ? 'disabled' : ''}>${sandboxToolState.isLoading ? 'Thinking...' : 'Send'}</button>
                    </form>
                </div>
            </div>

            <!-- 2. Editor Pane -->
            <div class="ide-pane ide-editor-pane">
                <div class="ide-editor-tabs">
                    <div class="editor-tab active" data-file="html"><span style="color: #E34C26">html</span> index.html</div>
                    <div class="editor-tab" data-file="css"><span style="color: #264de4">css</span> style.css</div>
                    <div class="editor-tab" data-file="js"><span style="color: #F7DF1E">js</span> script.js</div>
                </div>

                <textarea id="sandbox-html" class="ide-code-area" spellcheck="false" style="display: block;">${sandboxState.html}</textarea>
                <textarea id="sandbox-css" class="ide-code-area" spellcheck="false" style="display: none;">${sandboxState.css}</textarea>
                <textarea id="sandbox-js" class="ide-code-area" spellcheck="false" style="display: none;">${sandboxState.js}</textarea>
            </div>

            <!-- 3. Preview Pane -->
            <div class="ide-pane ide-preview-pane">
                <div class="ide-preview-header">
                    <div class="browser-dots">
                        <div class="browser-dot red"></div>
                        <div class="browser-dot yellow"></div>
                        <div class="browser-dot green"></div>
                    </div>
                    <div class="browser-bar-url">http://localhost:3000/app</div>
                    <div style="flex: 1;"></div>
                    <button class="ide-toggle-btn" id="ide-run-btn" title="Run Code" style="margin-right: 5px; color: var(--color-success); border-color: var(--color-success);">▶ Run</button>
                    <button class="ide-toggle-btn" id="ide-refresh-btn" title="Refresh Preview" style="margin-right: 5px;">↻</button>
                    <button class="ide-toggle-btn" id="ide-fullscreen-btn" title="Full Screen" style="padding: 2px 8px; font-size: 0.7rem;">⛶</button>
                </div>
                <iframe id="sandbox-preview-frame" class="ide-preview-frame" title="App Preview"></iframe>
            </div>
        </div>
    `;
}

function renderSandboxView(): string {
    const sandboxToolState = toolStates["Live Code Sandbox"] || { input: '', output: '', isLoading: false, error: null, useProjectContext: false };

    // Ensure we have a valid state object if toolStates was empty
    if (!toolStates["Live Code Sandbox"]) {
        toolStates["Live Code Sandbox"] = sandboxToolState;
    }

    return `
        <div class="sandbox-full-page-container">
            <div class="sandbox-ide-layout full-screen-mode">
                <!-- 1. Chat Pane -->
                <div class="ide-pane ide-chat-pane">
                    <div class="ide-pane-header">
                        <span>AI Architect</span>
                        <button class="action-btn small" title="Clear History" onclick="alert('Clear history not implemented yet')">🗑️</button>
                    </div>
                    <div class="ide-chat-history">
                        <div class="ide-chat-message ai">
                            <div class="message-avatar">🤖</div>
                            <div class="message-content">Hi! I'm your AI Architect. Describe your app, and I'll build it right here. You can ask for changes iteratively!</div>
                        </div>
                        <!-- Chat history would populate here -->
                    </div>
                    <div class="ide-chat-input-area">
                        <form id="sandbox-we-chat-form">
                            <textarea id="sandbox-ai-input" placeholder="e.g. 'Make the background dark blue', 'Add a contact form'..." ${sandboxToolState.isLoading ? 'disabled' : ''}></textarea>
                            <button type="submit" class="action-btn" style="width: 100%; margin-top: 10px;" ${sandboxToolState.isLoading ? 'disabled' : ''}>
                                ${sandboxToolState.isLoading ? '<span class="small-spinner"></span> Thinking...' : 'Generate Update'}
                            </button>
                        </form>
                    </div>
                </div>

                <!-- 2. Editor/Preview Pane -->
                <div class="ide-pane ide-workspace-pane">
                     <div class="ide-workspace-header">
                        <div class="ide-editor-tabs">
                            <div class="editor-tab active" data-pane="preview">Preview</div>
                            <div class="editor-tab" data-pane="code-html">index.html</div>
                            <div class="editor-tab" data-pane="code-css">style.css</div>
                            <div class="editor-tab" data-pane="code-js">script.js</div>
                        </div>
                        <div class="ide-actions">
                             <button class="ide-action-btn success" id="ide-run-btn" title="Run Code">▶ Run</button>
                             <button class="ide-action-btn" id="ide-download-btn" title="Download Project">⬇ Download</button>
                             <button class="ide-action-btn" id="ide-deploy-btn" title="Deploy to Render">🚀 Deploy</button>
                        </div>
                    </div>
                    
                    <div class="ide-workspace-content">
                        <!-- Preview Mode -->
                        <div id="workspace-preview" class="workspace-view active">
                             <iframe id="sandbox-preview-frame" class="ide-preview-frame" title="App Preview"></iframe>
                        </div>

                        <!-- Code Modes -->
                        <div id="workspace-code-html" class="workspace-view" style="display:none;">
                            <textarea id="sandbox-html" class="ide-code-area" spellcheck="false">${sandboxState.html}</textarea>
                        </div>
                        <div id="workspace-code-css" class="workspace-view" style="display:none;">
                            <textarea id="sandbox-css" class="ide-code-area" spellcheck="false">${sandboxState.css}</textarea>
                        </div>
                        <div id="workspace-code-js" class="workspace-view" style="display:none;">
                            <textarea id="sandbox-js" class="ide-code-area" spellcheck="false">${sandboxState.js}</textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderFileManagerTool(): string {
    return `
        < div class="file-manager-container" >
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
        </div >
        `;
}

function renderHeader(): string {
    return `
        <header>
        <div class="header-content">
            <div style="display: flex; align-items: center; gap: 15px;">
                <h1>AI Studio Launch Assistant</h1>
                <span id="app-version" class="version-badge" title="Click to view changelog">${CURRENT_VERSION}</span>
            </div>
            <nav>
                <a href="#" onclick="updateView('launchpad'); return false;" class="${currentView === 'launchpad' ? 'active' : ''}">Home</a>
                <a href="#" onclick="updateView('guide'); return false;" class="${currentView === 'guide' ? 'active' : ''}">Guide</a>
                <a href="#" onclick="updateView('sandbox'); return false;" class="${currentView === 'sandbox' ? 'active' : ''}">App Builder</a>
                <a href="#" onclick="updateView('tools'); return false;" class="${currentView === 'tools' ? 'active' : ''}">Tools</a>
            </nav>
            <button class="action-btn header-action-btn" onclick="resetApp()">Reset App</button>
        </div>
    </header>
        `;
}


function renderChangelogModal(): string {
    if (!isChangelogOpen) return '';

    const changelogItems = CHANGELOG.map(log => `
        < div class="changelog-item" >
            <div class="changelog-header">
                <span class="changelog-version">${log.version}</span>
                <span class="changelog-date">${log.date}</span>
            </div>
            <ul class="changelog-list">
                ${log.changes.map(change => `<li>${change}</li>`).join('')}
            </ul>
        </div >
        `).join('');

    return `
        < div class="custom-modal-overlay" onclick = "closeChangelog(event)" >
            <div class="custom-modal-content">
                <div class="custom-modal-header">
                    <h2>Changelog</h2>
                    <button class="close-modal-btn" onclick="toggleChangelog()">×</button>
                </div>
                <div class="custom-modal-body">
                    ${changelogItems}
                </div>
            </div>
        </div >
        `;
}

// --- Main View Rendering ---
function renderApp() {
    if (!appContainer) return;

    let mainContentHtml = '';

    // Assuming renderClarificationView, renderLaunchpadView, renderGuideView, renderToolsView exist or will be created
    // For now, using the existing render functions and wrapping them.
    if (isClarifying) {
        // mainContentHtml = renderClarificationView(); // Placeholder
        mainContentHtml = `< section id = "clarification-section" class="launchpad-section" aria - labelledby="clarification-heading" >
            <h2 id="clarification-heading">2. Confirm Project Scope</h2>
            <p>Clarification view content goes here.</p>
        </section > `;
    } else if (currentView === 'launchpad') {
        // mainContentHtml = renderLaunchpadView(); // Placeholder
        // The existing renderLaunchpad() function already renders the full content, so we need to adjust how renderApp works.
        // For this change, we'll just call renderLaunchpad directly and let it handle its content.
    } else if (currentView === 'guide') {
        // mainContentHtml = renderGuideView(); // Placeholder
    } else if (currentView === 'sandbox') {
        mainContentHtml = renderSandboxView();
    } else if (currentView === 'tools') {
        // mainContentHtml = renderToolsView(); // Placeholder
    }

    // The original updateView function already handles rendering the main content.
    // We need to modify updateView to include the header and modal.
    // For now, let's just ensure the header and modal are rendered.
    // The actual content rendering will still be handled by renderLaunchpad, renderGuide, renderTools.

    appContainer.innerHTML = `
        ${renderHeader()}
        ${renderChangelogModal()}
    <div id="main-content-wrapper">${mainContentHtml}</div>
    `;

    // Re-attach event listeners after rendering
    attachAllEventListeners();

    // Now, call the specific view renderer to populate #main-content-wrapper or appContainer directly
    // This part needs careful integration with the existing updateView logic.
    // For the purpose of this specific instruction, I'll assume `updateView` will be called after `renderApp`
    // or `renderApp` will replace the core logic of `updateView`.
    // Given the instruction, I'll modify `updateView` to use `renderHeader` and `renderChangelogModal`.
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
                    <p>The Sandbox has moved to its own dedicated App Builder experience!</p>
                    <div class="tool-card-container">
                         <button onclick="updateView('sandbox')" class="action-btn special-btn" style="width: 100%; padding: 15px; font-size: 1.1em;">
                            🚀 Open App Builder
                         </button>
                    </div>
                </div>
            </details>
            </section>
        `;
    }

    if (cardData.title === "Project File Manager") {
        return `
        < section class="guide-card type-step" aria - labelledby="heading-${toolTitleId}" >
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
            </section >
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
            outputHtml = `< div class="mermaid-diagram" id = "mermaid-output-container-${toolTitleId}" > ${toolState.output}</div > `;
        } else {
            outputHtml = sanitizeHtml(marked.parse(toolState.output) as string);
        }
    }

    const isContextAware = cardData.title === "PRD Generator" || cardData.title === "MVP Feature Scoper";
    const contextCheckboxId = `context - checkbox - ${toolTitleId} `;
    const contextCheckboxHtml = isContextAware ? `
        < div class="tool-context-toggle" >
            <input type="checkbox" id="${contextCheckboxId}" data-tool-title="${cardData.title}" ${toolState.useProjectContext ? 'checked' : ''} ${roadmapSteps.length === 0 ? 'disabled' : ''}>
                <label for="${contextCheckboxId}">Use Project Context from AI Launchpad</label>
                ${roadmapSteps.length === 0 ? '<span class="context-disabled-note">(Generate a plan in AI Launchpad first)</span>' : ''}
            </div>
    ` : '';

    const outputId = `tool - output - ${toolTitleId} `;

    return `
        < section class="guide-card type-step" aria - labelledby="heading-${toolTitleId}" >
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
        </section >
        `;
}


function updateView(newView?: AppView) {
    if (newView) {
        currentView = newView;
    }

    // Render the header and changelog modal first
    // Render the header (handled by static HTML) and changelog modal
    appContainer.innerHTML = `
        ${renderChangelogModal()}
    <div id="main-content-area"></div>
    `;

    const mainContentArea = document.getElementById('main-content-area') as HTMLElement;

    // Then render the specific view content into the main content area
    if (currentView === 'launchpad') {
        mainContentArea.innerHTML = `
        < div class="welcome-container" >
            <div class="welcome-content">
                <h1>Welcome to the AI Studio Launch Assistant</h1>
                <p>Your comprehensive guide to launching and deploying AI-powered applications.</p>
            </div>
            </div >
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
                        ${renderFilteredCards(detailedCards, 'active')}
                    </div>
                </section>

                <section class="launchpad-section" id="completed-roadmap-section" aria-labelledby="completed-roadmap-heading" style="display: ${!isClarifying && completedDetailedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="completed-roadmap-heading">Completed Steps</h2>
                    <div id="completed-cards-container">
                        ${renderFilteredCards(completedDetailedCards, 'completed')}
                    </div>
                </section>

                <section class="launchpad-section" id="archived-items-section" aria-labelledby="archived-items-heading" style="display: ${!isClarifying && archivedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="archived-items-heading">Archived Items</h2>
                    <div id="archived-cards-container">
                        ${renderFilteredCards(archivedCards, 'archived')}
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
    } else if (currentView === 'guide') {
        mainContentArea.innerHTML = `
        < h2 class="guide-main-heading" > AI Application Deployment Guide</h2 >
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
    } else { // Tools view
        mainContentArea.innerHTML = `
        < h2 class="guide-main-heading" > Developer Tools</h2 >
            <div id="tools-container">
                ${toolData.map(card => renderToolCard(card)).join('')}
            </div>
    `;
    }

    // Re-attach event listeners for the newly rendered content
    attachAllEventListeners();

    // Update active state for nav links
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('active');
        if (link.textContent?.toLowerCase() === (currentView === 'launchpad' ? 'home' : currentView)) {
            link.classList.add('active');
        }
    });

    if (globalAiError && !API_KEY) {
        const generateBtn = document.getElementById('generate-plan-btn') as HTMLButtonElement;
        if (generateBtn) generateBtn.disabled = true;
        const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
        if (errorDiv && !errorDiv.textContent) {
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

function toggleChangelog() {
    isChangelogOpen = !isChangelogOpen;
    updateView(currentView); // Re-render to show/hide modal
}

function closeChangelog(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('custom-modal-overlay')) {
        isChangelogOpen = false;
        updateView(currentView);
    }
}


// --- Event Listeners ---
function attachAllEventListeners() {
    // Configure highlight.js to suppress security warnings for trusted content
    hljs.configure({ ignoreUnescapedHTML: true });

    // Nav links are now handled by onclick in renderHeader, but we still need to attach other global listeners
    // Navigation Listeners (Restored for Static Header)
    const navLaunchpad = document.getElementById('nav-launchpad');
    const navGuide = document.getElementById('nav-guide');
    const navTools = document.getElementById('nav-tools');

    if (navLaunchpad) navLaunchpad.addEventListener('click', (e) => { e.preventDefault(); updateView('launchpad'); });
    if (navGuide) navGuide.addEventListener('click', (e) => { e.preventDefault(); updateView('guide'); });
    if (navTools) navTools.addEventListener('click', (e) => { e.preventDefault(); updateView('tools'); });

    // Version Click
    const versionBadge = document.getElementById('app-version');
    if (versionBadge) {
        versionBadge.addEventListener('click', toggleChangelog);
    }

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
            updateView(); // Re-render launchpad to filter cards
        });

        attachCardEventListeners();

    } else if (currentView === 'guide') {
        const searchInput = document.getElementById('guide-search-input');
        searchInput?.addEventListener('input', (e) => {
            guideSearchQuery = (e.target as HTMLInputElement).value;
            updateView(); // Re-render guide to filter cards
        });

        const interactiveChatForms = document.querySelectorAll('.guide-card .in-card-chat-form');
        interactiveChatForms.forEach(form => {
            form.addEventListener('submit', handleCardChatSubmit);
            const textarea = form.querySelector('textarea');
            if (textarea) {
                textarea.addEventListener('input', (e) => {
                    const cardId = form.getAttribute('data-card-id');
                    const card = findStaticCard(cardId || '');
                    if (card) {
                        card.currentChatQuery = (e.target as HTMLTextAreaElement).value;
                    }
                });
            }
        });

        const guideContainer = document.getElementById('main-content-area'); // Changed from appContainer to mainContentArea
        guideContainer?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const chatChip = target.closest('.chat-chip');
            if (chatChip) {
                const cardId = chatChip.getAttribute('data-card-id');
                const chipText = chatChip.textContent || '';

                if (cardId) {
                    const card = findStaticCard(cardId);
                    const inputEl = document.getElementById(`chat - input - ${cardId} `) as HTMLTextAreaElement;

                    if (card && inputEl) {
                        card.currentChatQuery = chipText;
                        inputEl.value = chipText;
                        inputEl.focus();
                        inputEl.style.height = 'auto';
                        inputEl.style.height = `${inputEl.scrollHeight} px`;
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
        const sandboxChatForm = document.getElementById('sandbox-we-chat-form');
        if (sandboxChatForm) {
            sandboxChatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const inputEl = document.getElementById('sandbox-ai-input') as HTMLTextAreaElement;
                const prompt = inputEl.value;
                if (!prompt) return;

                const toolTitle = "Live Code Sandbox";
                if (!toolStates[toolTitle]) toolStates[toolTitle] = { input: '', output: '...', isLoading: true, error: null, useProjectContext: false };

                toolStates[toolTitle].isLoading = true;
                // Append user message to chat UI immediately
                const historyContainer = document.querySelector('.ide-chat-history');
                if (historyContainer) {
                    const userMsg = document.createElement('div');
                    userMsg.className = 'ide-chat-message user';
                    userMsg.textContent = prompt;
                    historyContainer.appendChild(userMsg);
                    historyContainer.scrollTop = historyContainer.scrollHeight;
                }
                inputEl.value = ''; // Clear input

                // Re-render only keeps the isLoading state, but we don't want to destroy the DOM if we can help it, 
                // but for now we rely on renderToolsView to refresh the state. 
                // Wait! renderToolsView redraws everything. We need to be careful not to lose the internal state.
                // We should probably manually update DOM for chat instead of full re-render for smoother feel,
                // but to keep it simple with current architecture, we re-render.
                renderToolsView();

                try {
                    const updatedCode = await callGeminiForSandboxEdit(
                        sandboxState.html,
                        sandboxState.css,
                        sandboxState.js,
                        prompt
                    );

                    sandboxState.html = updatedCode.html;
                    sandboxState.css = updatedCode.css;
                    sandboxState.js = updatedCode.js;
                    saveStateToLocalStorage();

                    // Add AI response to history (mock, needs real state persistence for history)
                    // For now, after re-render, we lose the ephemeral chat divs unless we store them.
                    // We need to add 'chatHistory' to sandboxToolState.
                    // ... (Simplification: just re-render with new code)

                } catch (err) {
                    console.error("Sandbox edit error:", err);
                    toolStates[toolTitle].error = (err as Error).message;
                } finally {
                    toolStates[toolTitle].isLoading = false;
                    renderToolsView();
                    // Auto-run after update
                    handleRunSandbox();
                }
            });
        }

        // IDE Tabs
        document.querySelectorAll('.editor-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const fileType = tab.getAttribute('data-file');
                const htmlArea = document.getElementById('sandbox-html');
                const cssArea = document.getElementById('sandbox-css');
                const jsArea = document.getElementById('sandbox-js');

                if (htmlArea && cssArea && jsArea) {
                    htmlArea.style.display = 'none';
                    cssArea.style.display = 'none';
                    jsArea.style.display = 'none';

                    if (fileType === 'html') htmlArea.style.display = 'block';
                    if (fileType === 'css') cssArea.style.display = 'block';
                    if (fileType === 'js') jsArea.style.display = 'block';
                }
            });
        });

        // Run / Refresh / Fullscreen
        const runBtn = document.getElementById('ide-run-btn');
        if (runBtn) runBtn.addEventListener('click', handleRunSandbox);

        const refreshBtn = document.getElementById('ide-refresh-btn');
        if (refreshBtn) refreshBtn.addEventListener('click', handleRunSandbox); // Same action for now

        const fullscreenBtn = document.getElementById('ide-fullscreen-btn');
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => {
            const previewPane = document.querySelector('.ide-preview-pane');
            if (previewPane) {
                if (previewPane.classList.contains('fullscreen')) {
                    previewPane.classList.remove('fullscreen');
                    fullscreenBtn.textContent = '⛶';
                } else {
                    previewPane.classList.add('fullscreen');
                    fullscreenBtn.textContent = '✖';
                }
            }
        });

        const sandboxHtml = document.getElementById('sandbox-html') as HTMLTextAreaElement;
        const sandboxCss = document.getElementById('sandbox-css') as HTMLTextAreaElement;
        const sandboxJs = document.getElementById('sandbox-js') as HTMLTextAreaElement;

        if (sandboxHtml) sandboxHtml.addEventListener('input', () => { sandboxState.html = sandboxHtml.value; saveStateToLocalStorage(); });
        if (sandboxCss) sandboxCss.addEventListener('input', () => { sandboxState.css = sandboxCss.value; saveStateToLocalStorage(); });
        if (sandboxJs) sandboxJs.addEventListener('input', () => { sandboxState.js = sandboxJs.value; saveStateToLocalStorage(); });

        // Initial Run if not empty
        if (sandboxState.html || sandboxState.js) {
            handleRunSandbox();
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
        } catch (e) {
            console.error("Mermaid render error:", e);
            el.innerHTML = `< p class="error-message" > Error rendering diagram.Check Mermaid syntax.</p > `;
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
                    const inputEl = document.getElementById(`chat - input - ${cardId} `) as HTMLTextAreaElement;
                    if (card && inputEl) {
                        card.currentChatQuery = chipText;
                        inputEl.value = chipText;
                        inputEl.focus();
                        // Adjust textarea height
                        inputEl.style.height = 'auto';
                        inputEl.style.height = `${inputEl.scrollHeight} px`;
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
            if (textarea) {
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
    switch (projectInputMode) {
        case 'describe': userInput = currentProjectDescription; break;
        case 'url': userInput = `URL: ${currentProjectUrl} `; break;
        case 'code': userInput = `CODE: \n\`\`\`\n${currentProjectCode}\n\`\`\``; break;
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
        if (cardToMove.subSteps) {
            cardToMove.subSteps.forEach(s => s.completed = true);
        }
        completedDetailedCards.unshift(cardToMove);
        showUndoToast(`Step "${cardToMove.title}" completed.`);
    } else { // from 'completed'
        const index = completedDetailedCards.findIndex(c => c.id === cardId);
        completedDetailedCards.splice(index, 1);
        cardToMove.completed = false;
        detailedCards.push(cardToMove);
        detailedCards.sort((a, b) => {
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
        if (cardId) {
            const card = findCardGlobally(cardId);
            if (card && card.type === 'decision' && !card.isExpanded) {
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





// --- Initialization ---
function init() {
    initAI(API_KEY || "");
    loadStateFromLocalStorage();
    updateView('launchpad');
}

init();

// Expose functions to global scope for HTML onclick attributes
(window as any).updateView = updateView;
(window as any).resetApp = resetApp;
(window as any).toggleChangelog = toggleChangelog;
(window as any).closeChangelog = closeChangelog;
