
export type CardType = 'step' | 'decision' | 'option-best' | 'option-other' | 'warning';
export type AppView = 'launchpad' | 'guide' | 'tools';
export type ProjectInputMode = 'describe' | 'url' | 'code';

export interface SubStep {
  id: string; // e.g., cardId-sub-0
  instruction: string;
  completed: boolean;
}

export interface ChatMessage {
  id: string; // e.g., cardId-chat-msg-0
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface StaticGuideCardData {
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

export interface DetailedCardData {
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

export interface SandboxState {
    html: string;
    css: string;
    js: string;
}

export interface SandboxCode {
    html: string;
    css: string;
    js: string;
}

export interface RoadmapStep {
  id: string; // Corresponds to the generated card ID
  title: string;
  type: CardType;
  completed: boolean;
  relatedCardId: string; // ID of the detailed card this roadmap step links to
  isArchived?: boolean;
  activatedByOptionId?: string;
}

export interface ApplicationState {
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

export interface ToolState {
    [toolTitle: string]: {
        input: string;
        output: string;
        isLoading: boolean;
        error: string | null;
        useProjectContext: boolean;
    }
}
