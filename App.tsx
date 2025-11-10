import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { initializeAiClient, enhancePrompt, refinePrompt, getSuggestions, correctText, generateImageFromPrompt, processFeedback } from './services/geminiService';
import { SparklesIcon, ClipboardIcon, CheckIcon, SpinnerIcon, HistoryIcon, CloseIcon, ReuseIcon, SearchIcon, TemplateIcon, DownloadIcon, LightbulbIcon, MicrophoneIcon, EnvelopeIcon, WandIcon, ImageIcon, SwatchesIcon, AspectRatioIcon, SortIcon } from './components/icons';

// Fix for SpeechRecognition API not being in standard TS types
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    start: () => void;
    stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
}

interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
}

interface SpeechRecognitionAlternative {
    transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

// Define the type for a history item
type PromptHistoryItem = {
    id: number;
    original: string;
    enhanced: string;
    templateName: string;
};

// Define the type for a prompt template
export type PromptTemplate = {
    id:string;
    name: string;
    description: string;
    template: string;
    category: string;
    tags: string[];
    isDefault?: boolean;
};

// Pre-defined prompt templates
const defaultPromptTemplates: PromptTemplate[] = [
    {
        id: 'expert-enhancer',
        name: 'Dynamic Expert Enhancer (Recommended)',
        description: 'A revolutionary multi-step process. An AI "council of experts" analyzes your idea, provides multi-faceted feedback, and then a master synthesizer crafts a world-class prompt. This is the most powerful option for maximum creativity and detail.',
        category: 'General',
        tags: ['advanced', 'creative', 'world-class', 'recommended'],
        isDefault: true,
        template: `You are a master AI prompt architect. Your task is to execute a sophisticated, multi-step "Chain of Thought" process to transform a user's simple idea into a world-class, professional-grade prompt for a generative AI.

**The Process:**

**Step 1: Idea Deconstruction and Expert Council Formation**
First, deeply analyze the user's core concept. Based on this analysis, you will form a virtual "Council of Experts" composed of 3 to 5 distinct, relevant personas. These personas should be highly specific and tailored to the user's idea. For example, if the idea is "a spaceship," the council could include a "Veteran Sci-Fi Concept Artist," a "NASA Propulsion Engineer," and a "Cinematic VFX Supervisor."

**Step 2: Simulated Expert Roundtable**
Next, you will simulate a creative roundtable discussion. Each expert on the council will provide their unique, specialized input to dramatically improve the initial concept. They will add layers of detail, nuance, and technical specificity from their professional perspective.

**Step 3: Master Synthesis**
Finally, acting as the Master Prompt Synthesizer, you will meticulously review the insights from the expert roundtable. You will then synthesize all of these rich details into a single, cohesive, and exceptionally detailed final prompt.

**Crucial Instructions:**
-   **You understand multiple languages, including Hinglish.** If the user's prompt is in Hinglish, fully understand its intent and cultural context. The entire enhancement process should be based on this understanding, but the final synthesized prompt must be in clear, professional English for the generative AI.
-   **The entire process (Steps 1, 2, and 3) must happen internally within your reasoning process.**
-   **Output ONLY the final, synthesized prompt from Step 3.** Do not show the expert council, their discussion, or any other intermediate steps. Do not include any conversational text, introductions, explanations, or labels like "Final Prompt:".
-   The final output must be a single, comprehensive block of text, ready to be copied and pasted into a generative AI tool.

**User's Original Idea:**
---
{userInput}
---

Now, execute this entire process and generate the final, world-class prompt.`
    },
    {
        id: 'default',
        name: 'Classic Enhancer',
        description: 'Your all-purpose starting point. This template takes any basic idea and enriches it with vivid details, a specific artistic style, and a clear scene. Ideal for when you want a highly creative and descriptive output but are not tied to a specific format.',
        category: 'General',
        tags: ['creative', 'detailed', 'all-purpose'],
        isDefault: false,
        template: `You are a world-class AI prompt engineer. Your mission is to take a user's simple, vague, or low-quality prompt and transform it into a masterpiece of clarity, detail, and creative direction. The goal is to generate a professional-grade prompt that will guide a generative AI (like an image or text model) to produce a stunning and specific output.

**Your Enhancement Process:**
1.  **Deconstruct the Core Idea:** Identify the fundamental subject and intent of the user's prompt.
2.  **Inject Rich Detail:** Elaborate on the subject. What are its characteristics? Texture? Age? Expression?
3.  **Establish the Scene:** Build a world around the subject. Where is it? What's the environment? Time of day? Weather?
4.  **Define the Artistic Style:** Specify a clear artistic direction. Examples: "Photorealistic, 8K, cinematic," "Impressionistic oil painting," "Cyberpunk anime concept art," "Vintage 1950s travel poster."
5.  **Master the Composition:** Dictate the virtual camera work. Examples: "Dynamic low-angle shot," "Intimate close-up," "Sweeping panoramic view," "Rule of thirds composition."
6.  **Control the Lighting:** Set the mood with precise lighting instructions. Examples: "Golden hour lighting casting long shadows," "Dramatic Rembrandt lighting," "Eerie bioluminescent glow," "Soft, diffused morning light."
7.  **Infuse Mood & Emotion:** Describe the desired feeling. Examples: "A sense of awe and wonder," "A feeling of quiet melancholy," "An atmosphere of high-octane action and chaos."
8.  **Add Technical Keywords:** Include relevant technical terms that AI models understand, such as "hyperdetailed," "UHD," "trending on ArtStation," "Unreal Engine 5 render."

**Crucial Instructions:**
-   **You understand multiple languages, including Hinglish (a mix of Hindi and English).** If the user's prompt is in Hinglish, fully understand its intent, cultural context, and creative idea. Then, generate the enhanced prompt in clear, professional English, as that is what generative AI models understand best.
-   **Output ONLY the enhanced prompt.** Do not include any conversational text, introductions, explanations, or labels like "Enhanced Prompt:".
-   The final output must be a single, cohesive block of text ready to be copied and pasted into a generative AI tool.
-   If the user's prompt is already very detailed, refine and polish it further, focusing on artistic nuance and technical precision.

**User's Original Prompt:**
---
{userInput}
---

Now, generate the enhanced prompt based on these instructions.`
    },
    {
        id: 'image-gen',
        name: 'Image Generation Pro',
        description: 'Optimized for visual AI like Midjourney, DALL-E, or Stable Diffusion. This template transforms your concept into a detailed shot list, specifying camera angles, lighting, composition, art style, and technical keywords to generate stunning, precise images.',
        category: 'Creative',
        tags: ['image', 'art', 'visual', 'midjourney'],
        isDefault: false,
        template: `You are a prompt engineer for an advanced AI image generation model (like Midjourney or DALL-E 3). Your task is to take a user's simple concept and expand it into a rich, detailed, and artistically specific prompt.

**Instructions:**
-   You are fluent in Hinglish. If the user's concept is in Hinglish, interpret it and create a detailed prompt in professional English to ensure the best results from the image model.
-   Focus on visual elements: subject, composition, style, lighting, color palette, and camera details.
-   Use descriptive adjectives and sensory details.
-   Structure the prompt logically, often starting with the main subject.
-   Incorporate keywords that image models understand well, like "photorealistic, 8k, cinematic lighting, hyperdetailed, trending on Artstation, Unreal Engine".
-   Specify an art style (e.g., "impressionist painting", "cyberpunk concept art", "vintage photograph").
-   Define the camera shot (e.g., "wide-angle shot", "macro shot", "dutch angle").
-   Do NOT add any text that isn't part of the final prompt. No explanations, no "Here is the enhanced prompt:". Output ONLY the prompt itself.

**User's Concept:**
---
{userInput}
---

Generate the final, detailed image prompt now.`
    },
    {
        id: 'copywriting',
        name: 'Marketing Copywriter',
        description: 'Designed for creating persuasive sales and marketing content. This template guides the AI to think like a professional copywriter, focusing on the target audience, tone of voice, key value propositions, and a compelling call-to-action (CTA) for ads, social media, or product descriptions.',
        category: 'Marketing',
        tags: ['copywriting', 'ads', 'social media', 'product'],
        isDefault: false,
        template: `You are an expert marketing copywriter and AI prompt engineer. Your goal is to take a user's product idea or topic and transform it into a prompt that an AI text model can use to generate compelling marketing copy (e.g., ad copy, social media posts, product descriptions).

**Instructions:**
-   You can understand ideas written in Hinglish. If the user's topic is in Hinglish, understand the core marketing need and generate the prompt in professional English.
-   Identify the target audience and the core value proposition from the user's input.
-   Structure the prompt to ask for specific formats (e.g., "Write 3 Facebook ad headlines", "Generate a 100-word product description").
-   Incorporate key copywriting formulas like AIDA (Attention, Interest, Desire, Action) or PAS (Problem, Agitate, Solve) into the prompt's request.
-   Specify the desired tone of voice (e.g., "professional and authoritative", "playful and witty", "empathetic and supportive").
-   Ask the AI to include a clear Call To Action (CTA).
-   Do NOT add any text that isn't part of the final prompt. No explanations. Output ONLY the prompt itself.

**User's Topic/Product:**
---
{userInput}
---

Generate the final, detailed copywriting prompt now.`
    },
    {
        id: 'code-gen',
        name: 'Code Generator Assistant',
        description: 'For developers and programmers. This template structures your request into a precise technical specification for an AI coding assistant. It helps define the programming language, libraries, function inputs/outputs, and error handling, resulting in more accurate and reliable code.',
        category: 'Technical',
        tags: ['code', 'development', 'software', 'programming'],
        isDefault: false,
        template: `You are a senior software engineer and AI prompt specialist. Your task is to convert a user's plain-language request for a piece of code into a clear, detailed, and unambiguous prompt for an AI code generation model.

**Instructions:**
-   You can understand technical requests written in Hinglish. If the user's request is in Hinglish, translate the requirements into a precise technical prompt in English.
-   Specify the programming language and any necessary frameworks or libraries.
-   Clearly define the function/component's purpose, inputs (with data types), and expected outputs (with data types).
-   Include requirements for error handling, edge cases, and performance considerations.
-   Ask for code comments to explain complex logic.
-   If it's a UI component, describe its appearance and behavior.
-   The prompt should be structured to be easily understood by a code-generation model like Gemini or a fine-tuned version of GPT.
-   Do NOT add any text that isn't part of the final prompt. No explanations. Output ONLY the prompt itself.

**User's Request:**
---
{userInput}
---

Generate the final, detailed code generation prompt now.`
    }
];

const artisticStyles = [
    'None', 'Photorealistic', 'Cinematic', 'Anime', 'Watercolor', 'Oil Painting', 
    'Cyberpunk', 'Steampunk', 'Fantasy Art', 'Abstract', 'Minimalist', 'Vintage Photo'
];

const presetPrompts = [
    { name: 'Fantasy Landscape', prompt: 'Breathtaking fantasy landscape, matte painting, epic scale, towering mountains, mystical forest, shimmering waterfalls, volumetric lighting, hyperdetailed, 8K, trending on Artstation.' },
    { name: 'Sci-fi Character', prompt: 'Full body portrait of a futuristic sci-fi character, intricate cybernetic enhancements, detailed armor, glowing neon accents, cinematic lighting, photorealistic, Unreal Engine 5 render.' },
    { name: 'Cozy Room Interior', prompt: 'A cozy, cluttered room interior, soft morning light filtering through a large window, plants on the windowsill, a steaming cup of coffee on a wooden table, Studio Ghibli inspired anime style, warm color palette.' },
    { name: 'Cyberpunk Cityscape', prompt: 'Sprawling cyberpunk cityscape at night, neon-drenched skyscrapers, flying vehicles, rain-slicked streets reflecting the glowing signs, Blade Runner aesthetic, cinematic, hyper-realistic.' },
    { name: 'Mythical Creature', prompt: 'An ethereal and majestic mythical creature, a griffin with iridescent feathers, perched on a cliff overlooking a stormy sea, dramatic lighting, fantasy concept art, highly detailed.' },
    { name: 'Food Photography', prompt: 'Delicious and vibrant food photography, a stack of fluffy pancakes with melting butter and dripping maple syrup, fresh berries on the side, shallow depth of field, professional food styling, 8k, photorealistic.' },
];

const liveExamplePrompts = [
    "A photorealistic image of an astronaut discovering a glowing, crystalline forest on an alien planet, two moons in the sky.",
    "Cinematic shot of a lone samurai warrior standing on a cliff overlooking a stormy sea, cherry blossom petals flying in the wind.",
    "Steampunk-style airship navigating through a city of towering, bronze skyscrapers, intricate gears and steam vents visible.",
    "A cozy, cluttered wizard's workshop, shelves filled with glowing potions and ancient books, a magical creature sleeping by the fireplace, anime style.",
    "Epic fantasy art of a majestic dragon with iridescent scales, perched atop a snow-covered mountain peak at sunrise.",
    "Cyberpunk cityscape at night, neon-drenched streets, flying cars, a mysterious figure in a trench coat looking up at the holographic ads.",
    "A beautiful watercolor painting of a Venetian canal scene, gondolas gently floating, colorful buildings reflected in the water.",
    "Minimalist vector art of a solitary deer in a misty, pine forest, using a limited color palette of blues and grays.",
    "An epic oil painting of a fierce naval battle between pirate ships during a thunderstorm, dramatic waves crashing.",
    "Vintage 1950s travel poster for a futuristic city on Mars, retro-style rockets and smiling families in space suits."
];

// Header Component
const Header: React.FC = () => (
    <header className="text-center p-4 md:p-6 z-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-center">
            <h1 className="text-5xl md:text-6xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-brand-magenta to-brand-indigo">
                PromptMatrix
            </h1>
        </div>
        <p className="mt-3 text-lg text-brand-text-secondary font-light">
            Constructing World-Class AI Prompts from Your Core Ideas.
        </p>
    </header>
);

const LoadingSkeleton: React.FC = () => (
    <div className="rounded-2xl flex flex-col h-full bg-brand-surface backdrop-blur-xl p-6 border border-brand-border">
        <div className="shimmer-bg h-6 w-1/3 rounded-md mb-6"></div>
        <div className="space-y-3">
            <div className="shimmer-bg h-4 w-full rounded-md"></div>
            <div className="shimmer-bg h-4 w-5/6 rounded-md"></div>
            <div className="shimmer-bg h-4 w-full rounded-md"></div>
            <div className="shimmer-bg h-4 w-3/4 rounded-md"></div>
        </div>
    </div>
);

// PromptOutput Component
interface PromptOutputProps {
    title: string;
    prompt: string;
    isEnhanced?: boolean;
    onGenerateImage?: () => void;
    isGeneratingImage?: boolean;
}

const PromptOutput: React.FC<PromptOutputProps> = ({ title, prompt, isEnhanced = false, onGenerateImage, isGeneratingImage }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!prompt) return;
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const handleDownload = () => {
        if (!prompt) return;
        const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'enhanced-prompt.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const wordCount = prompt ? prompt.split(/\s+/).filter(Boolean).length : 0;
    const lines = prompt ? prompt.split('\n') : [];

    return (
        <div className={`rounded-2xl flex flex-col h-full bg-brand-surface backdrop-blur-xl relative transition-all duration-300 border border-brand-border group`}>
             {isEnhanced && <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-brand-indigo to-brand-magenta opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>}
            <div className="p-6 pb-4 flex-shrink-0 relative">
                <div className="flex justify-between items-center gap-2">
                    <h3 className="text-xl font-bold font-display text-brand-text-primary">{title}</h3>
                    {isEnhanced && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {onGenerateImage && (
                                <button
                                    onClick={onGenerateImage}
                                    className="flex items-center px-3 py-1.5 text-sm font-medium bg-brand-indigo hover:bg-brand-indigo/80 text-white rounded-md transition-all duration-200 disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-wait"
                                    disabled={!prompt || isGeneratingImage}
                                >
                                    {isGeneratingImage ? <SpinnerIcon className="w-4 h-4 mr-2 animate-spin"/> : <ImageIcon className="w-4 h-4 mr-2" />}
                                    {isGeneratingImage ? 'Generating...' : 'Generate Image'}
                                </button>
                            )}
                            <button
                                onClick={handleDownload}
                                className="flex items-center px-3 py-1.5 text-sm font-medium bg-white/5 hover:bg-white/10 rounded-md transition-all duration-200 disabled:opacity-50 text-brand-text-secondary hover:text-white"
                                disabled={!prompt}
                            >
                                <DownloadIcon className="w-4 h-4 mr-2" />
                                Save
                            </button>
                            <button
                                onClick={handleCopy}
                                className="flex items-center px-3 py-1.5 text-sm font-medium bg-white/5 hover:bg-white/10 rounded-md transition-all duration-200 disabled:opacity-50 text-brand-text-secondary hover:text-white"
                                disabled={!prompt}
                            >
                                {copied ? (
                                    <>
                                        <CheckIcon className="w-4 h-4 mr-2 text-brand-magenta" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <ClipboardIcon className="w-4 h-4 mr-2" />
                                        Copy
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-grow font-mono leading-relaxed overflow-y-auto bg-black/20 text-sm relative">
                 {isEnhanced && prompt ? (
                    <div className="py-4">
                        <table className="w-full border-collapse">
                            <tbody>
                                {lines.map((line, index) => (
                                    <tr key={index} className="hover:bg-white/5 transition-colors duration-200">
                                        <td className="pl-6 pr-4 text-right text-brand-text-secondary/50 select-none align-top w-12" aria-hidden="true">
                                            {index + 1}
                                        </td>
                                        <td className="pr-6 text-brand-text-primary align-top">
                                            <pre className="m-0 p-0 whitespace-pre-wrap break-words">{line || ' '}</pre>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-6 py-4">
                        <pre className="whitespace-pre-wrap text-brand-text-secondary"><code>{prompt || "..."}</code></pre>
                    </div>
                )}
            </div>
            {prompt && (
                <div className="p-6 pt-4 border-t border-brand-border text-right text-xs text-brand-text-secondary/70 flex-shrink-0 relative">
                    {wordCount} {wordCount === 1 ? 'word' : 'words'} &bull; {prompt.length} characters
                </div>
            )}
        </div>
    );
};


// History Modal Component
interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: PromptHistoryItem[];
    onSelectPrompt: (prompt: string) => void;
    templates: PromptTemplate[];
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onSelectPrompt, templates }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('recent');
    const [filterTemplate, setFilterTemplate] = useState('all');

    if (!isOpen) return null;

    const sortOptions = [
        { value: 'recent', label: 'Sort: Most Recent' },
        { value: 'oldest', label: 'Sort: Oldest First' },
        { value: 'original-asc', label: 'Sort: Original Length' },
        { value: 'enhanced-asc', label: 'Sort: Enhanced Length' },
    ];

    const templateOptions = useMemo(() => [
        { value: 'all', label: 'Filter: All Templates' },
        ...[...new Set(templates.map(t => t.name))].map(name => ({ value: name, label: name }))
    ], [templates]);

    const processedHistory = useMemo(() => {
        let items = [...history];

        // 1. Filter by template
        if (filterTemplate !== 'all') {
            items = items.filter(item => item.templateName === filterTemplate);
        }

        // 2. Filter by search query
        if (searchQuery.trim() !== '') {
            const lowercasedQuery = searchQuery.toLowerCase();
            items = items.filter(item =>
                item.original.toLowerCase().includes(lowercasedQuery) ||
                item.enhanced.toLowerCase().includes(lowercasedQuery)
            );
        }

        // 3. Sort
        switch (sortOrder) {
            case 'oldest':
                items.sort((a, b) => a.id - b.id);
                break;
            case 'original-asc':
                items.sort((a, b) => a.original.length - b.original.length);
                break;
            case 'enhanced-asc':
                items.sort((a, b) => a.enhanced.length - b.enhanced.length);
                break;
            case 'recent':
            default:
                items.sort((a, b) => b.id - a.id);
                break;
        }

        return items;
    }, [history, searchQuery, sortOrder, filterTemplate]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-brand-bg/80 border border-brand-border backdrop-blur-2xl rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col animate-fade-in-up">
                <div className="p-4 border-b border-brand-border flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-semibold font-display text-brand-text-primary">Prompt History</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-4 border-b border-brand-border flex-shrink-0">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search history..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-black/20 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-indigo focus:outline-none transition-all duration-200 text-brand-text-primary placeholder-brand-text-secondary/50"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-brand-text-secondary" />
                        </div>
                    </div>
                     <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CustomSelect
                            id="history-sort"
                            value={sortOrder}
                            onChange={setSortOrder}
                            options={sortOptions}
                            icon={<SortIcon className="w-5 h-5 text-brand-text-secondary" />}
                        />
                        <CustomSelect
                            id="history-filter-template"
                            value={filterTemplate}
                            onChange={setFilterTemplate}
                            options={templateOptions}
                            icon={<TemplateIcon className="w-5 h-5 text-brand-text-secondary" />}
                        />
                    </div>
                </div>
                <div className="overflow-y-auto p-6 space-y-6">
                    {history.length === 0 ? (
                        <p className="text-brand-text-secondary text-center py-8">No history yet. Generate a matrix to see it here.</p>
                    ) : processedHistory.length === 0 ? (
                        <p className="text-brand-text-secondary text-center py-8">No prompts found with the current filters.</p>
                    ) : (
                        processedHistory.map((item, index) => (
                            <div key={item.id} className="bg-white/5 p-4 rounded-lg border border-brand-border animate-fade-in-up" style={{animationDelay: `${index * 50}ms`}}>
                                <div className="flex justify-between items-center mb-2 gap-4">
                                    <p className="text-xs text-brand-text-secondary font-semibold tracking-wider uppercase">Original</p>
                                    {item.templateName && <span className="px-2 py-0.5 bg-brand-indigo/30 text-brand-indigo rounded-full text-xs font-medium truncate shrink-0" title={item.templateName}>{item.templateName}</span>}
                                </div>
                                <p className="text-brand-text-secondary mb-4 font-mono text-sm">{item.original}</p>
                                <p className="text-xs text-brand-magenta mb-2 font-semibold tracking-wider uppercase">Enhanced</p>
                                <p className="text-brand-text-primary whitespace-pre-wrap font-mono text-sm leading-relaxed mb-4">{item.enhanced}</p>
                                <button
                                    onClick={() => onSelectPrompt(item.original)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-brand-indigo hover:bg-brand-indigo/80 rounded-md transition-colors"
                                >
                                    <ReuseIcon className="w-4 h-4" />
                                    Reuse Original
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// Feedback Modal Component
interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
    const [name, setName] = useState('');
    const [feedback, setFeedback] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [feedbackResult, setFeedbackResult] = useState<{ category: string; summary: string; priority: string } | null>(null);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);

    if (!isOpen) return null;
    
    const handleClose = () => {
        // Reset state on close
        setName('');
        setFeedback('');
        setIsSending(false);
        setIsSent(false);
        setFeedbackResult(null);
        setFeedbackError(null);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedback.trim() || isSending) return;

        setIsSending(true);
        setFeedbackError(null);
        try {
            const result = await processFeedback(name, feedback); 
            setFeedbackResult(result);
            setIsSent(true);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setFeedbackError(errorMessage);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-brand-bg/80 border border-brand-border backdrop-blur-2xl rounded-xl shadow-2xl w-full max-w-lg flex flex-col animate-fade-in-up">
                <div className="p-4 border-b border-brand-border flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-semibold font-display text-brand-text-primary">Share Your Feedback</h2>
                    <button onClick={handleClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                {isSent && feedbackResult ? (
                    <div className="p-8 text-center">
                        <CheckIcon className="w-16 h-16 text-brand-magenta mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-brand-text-primary mb-2 font-display">Thank You!</h3>
                        <p className="text-brand-text-secondary mb-6">Your feedback has been successfully processed by our AI assistant.</p>
                        <div className="text-left bg-white/5 p-4 rounded-lg border border-brand-border space-y-3">
                            <div>
                                <strong className="text-brand-text-secondary font-semibold">Summary: </strong> 
                                <span>{feedbackResult.summary}</span>
                            </div>
                            <div>
                                <strong className="text-brand-text-secondary font-semibold">Category: </strong> 
                                <span className="px-2 py-0.5 bg-brand-indigo/30 text-brand-indigo rounded-full text-xs font-medium">{feedbackResult.category}</span>
                            </div>
                             <div>
                                <strong className="text-brand-text-secondary font-semibold">Priority: </strong> 
                                <span>{feedbackResult.priority}</span>
                            </div>
                        </div>
                        <button onClick={handleClose} className="w-full mt-6 px-6 py-3 text-base font-bold text-white bg-brand-indigo hover:bg-brand-indigo/80 rounded-lg transition-all">
                            Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                         <div>
                            <label htmlFor="feedback-name" className="text-sm font-medium text-brand-text-secondary mb-2 block">Your Name (Optional)</label>
                            <input
                                id="feedback-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Jane Doe"
                                className="w-full p-3 bg-black/20 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-indigo/80 focus:outline-none transition-all duration-200 text-brand-text-primary placeholder-brand-text-secondary/50"
                                disabled={isSending}
                            />
                        </div>
                        <div>
                            <label htmlFor="feedback-message" className="text-sm font-medium text-brand-text-secondary mb-2 block">Your Feedback</label>
                            <textarea
                                id="feedback-message"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="I love this app, but I wish it could..."
                                rows={5}
                                required
                                className="w-full p-3 bg-black/20 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-indigo/80 focus:outline-none transition-all duration-200 text-brand-text-primary placeholder-brand-text-secondary/50 resize-y"
                                disabled={isSending}
                            />
                        </div>
                        {feedbackError && (
                            <p className="text-sm text-red-400 text-center">{feedbackError}</p>
                        )}
                        <button
                            type="submit"
                            disabled={!feedback.trim() || isSending}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3 text-base font-bold text-white bg-gradient-to-r from-brand-indigo to-brand-magenta rounded-lg transition-all duration-300 disabled:opacity-50 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(217,70,239,0.5)]"
                        >
                            {isSending ? (
                                <>
                                    <SpinnerIcon className="w-5 h-5 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                'Send Feedback'
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

// Custom Select Component to replace native select
type SelectOption = {
    value: string;
    label: string;
};

interface CustomSelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    icon?: React.ReactNode;
    id?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, placeholder, disabled = false, icon, id }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (newValue: string) => {
        onChange(newValue);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const baseClasses = "w-full flex items-center justify-between p-3 bg-black/20 border border-brand-border rounded-lg focus-within:ring-2 focus-within:ring-brand-indigo/80 focus:outline-none transition-all duration-200 text-brand-text-primary";

    return (
        <div ref={selectRef} className="relative w-full">
            <button
                id={id}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`${baseClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-3 truncate">
                    {icon}
                    <span className={`truncate ${selectedOption ? 'text-brand-text-primary' : 'text-brand-text-secondary/70'}`}>
                        {selectedOption?.label || placeholder || 'Select...'}
                    </span>
                </div>
                <svg className={`w-5 h-5 text-brand-text-secondary transition-transform duration-200 flex-shrink-0 ${isOpen ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </button>
            {isOpen && (
                <div className="absolute z-30 mt-1 w-full bg-brand-bg/90 backdrop-blur-xl border border-brand-border rounded-lg shadow-2xl overflow-hidden animate-fade-in-up" style={{ animationDuration: '150ms', animationDelay: '0ms', opacity: 1, transform: 'translateY(0)' }}>
                    <ul role="listbox" className="max-h-60 overflow-y-auto">
                        {options.map(option => (
                            <li
                                key={option.value}
                                id={`${id}-${option.value}`}
                                role="option"
                                aria-selected={value === option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`p-3 text-sm cursor-pointer hover:bg-brand-indigo/20 transition-colors duration-150 ${value === option.value ? 'bg-brand-indigo/30 text-white' : 'text-brand-text-secondary hover:text-white'}`}
                            >
                                {option.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// Aspect Ratio Selector Component
const AspectRatioSelector: React.FC<{
    id: string;
    selectedRatio: string;
    onSelect: (ratio: string) => void;
    disabled: boolean;
}> = ({ id, selectedRatio, onSelect, disabled }) => {
    const ratioOptions: SelectOption[] = [
        { value: '1:1', label: 'Square (1:1)' },
        { value: '16:9', label: 'Landscape (16:9)' },
        { value: '9:16', label: 'Portrait (9:16)' },
    ];
    
    return (
        <div className="w-full">
            <label htmlFor={id} className="sr-only">Aspect Ratio</label>
            <CustomSelect
                id={id}
                value={selectedRatio}
                onChange={onSelect}
                disabled={disabled}
                options={ratioOptions}
                icon={<AspectRatioIcon className="w-5 h-5 text-brand-text-secondary" />}
            />
        </div>
    );
};

// Artistic Style Selector Component
const ArtisticStyleSelector: React.FC<{
    id: string;
    selectedStyle: string;
    onSelect: (style: string) => void;
    disabled: boolean;
}> = ({ id, selectedStyle, onSelect, disabled }) => {
    const styleOptions: SelectOption[] = artisticStyles.map(style => ({
        value: style.toLowerCase().replace(' ', '-'),
        label: style
    }));
    
    return (
        <div className="w-full">
            <label htmlFor={id} className="sr-only">Artistic Style</label>
            <CustomSelect
                id={id}
                value={selectedStyle}
                onChange={onSelect}
                disabled={disabled}
                options={styleOptions}
                icon={<SwatchesIcon className="w-5 h-5 text-brand-text-secondary" />}
            />
        </div>
    );
};

// Helper function to apply artistic styles more effectively
const applyArtisticStyle = (prompt: string, style: string): string => {
    if (!prompt || style === 'none') {
        return prompt;
    }

    // Sanitize prompt: remove trailing commas or periods for cleaner concatenation.
    const cleanPrompt = prompt.trim().replace(/[.,]$/, '');

    switch (style) {
        case 'photorealistic':
            return `Ultra-photorealistic, hyper-detailed photograph of ${cleanPrompt}, 8K, professional photography.`;
        case 'cinematic':
            return `Cinematic film still of ${cleanPrompt}, dramatic lighting, epic composition, shallow depth of field, anamorphic lens flare.`;
        case 'anime':
            return `${cleanPrompt}, in the style of a modern fantasy anime movie, vibrant colors, detailed characters, beautiful scenery, trending on Pixiv.`;
        case 'watercolor':
            return `A beautiful and delicate watercolor painting of ${cleanPrompt}, soft edges, wet-on-wet technique, vibrant washes of color on textured paper.`;
        case 'oil-painting':
            return `An epic oil painting of ${cleanPrompt}, visible expressive brushstrokes, impasto texture, style of the old masters.`;
        case 'cyberpunk':
            return `Cyberpunk concept art of ${cleanPrompt}, neon-drenched cityscape, dystopian atmosphere, high-tech cybernetics, Blade Runner aesthetic.`;
        case 'steampunk':
            return `Steampunk illustration of ${cleanPrompt}, intricate gears and clockwork, polished brass and copper, Victorian-era technology.`;
        case 'fantasy-art':
            return `Epic high-fantasy digital painting of ${cleanPrompt}, mystical atmosphere, glowing magic, Lord of the Rings inspired, trending on ArtStation.`;
        case 'abstract':
            return `An abstract expressionist interpretation of "${cleanPrompt}", dynamic shapes, bold colors, non-representational, evocative and emotional.`;
        case 'minimalist':
            return `Minimalist vector art of ${cleanPrompt}, clean lines, simple shapes, limited color palette, flat design.`;
        case 'vintage-photo':
            return `A gritty, grainy, sepia-toned vintage photograph of ${cleanPrompt} from the 1920s, scratches and film grain, authentic period look.`;
        default:
            return `${cleanPrompt}, in the style of ${style.replace('-', ' ')}.`;
    }
};


// Main App Component
const App: React.FC = () => {
    const [isInitializing, setIsInitializing] = useState<boolean>(true);
    const [initializationError, setInitializationError] = useState<string | null>(null);
    const [userInput, setUserInput] = useState<string>('');
    const [enhancedPromptPro, setEnhancedPromptPro] = useState<string>('');
    const [enhancedPromptFlash, setEnhancedPromptFlash] = useState<string>('');
    const [originalPrompt, setOriginalPrompt] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isCorrecting, setIsCorrecting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<PromptHistoryItem[]>(() => {
        try {
            const savedHistory = localStorage.getItem('promptHistory');
            return savedHistory ? JSON.parse(savedHistory) : [];
        } catch (error) {
            console.error("Could not load history from localStorage", error);
            return [];
        }
    });
    const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(false);
    const [isFeedbackVisible, setIsFeedbackVisible] = useState<boolean>(false);
    const [isComparing, setIsComparing] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [speechSupport, setSpeechSupport] = useState<boolean>(false);
    
    // State for enhanced prompt image generation
    const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
    const [imageAspectRatio, setImageAspectRatio] = useState<string>('1:1');
    const [imageArtisticStyle, setImageArtisticStyle] = useState<string>('none');

    // State for direct AI image creator
    const [imageGenPrompt, setImageGenPrompt] = useState<string>('');
    const [isGeneratingDirectImage, setIsGeneratingDirectImage] = useState<boolean>(false);
    const [directGeneratedImage, setDirectGeneratedImage] = useState<string | null>(null);
    const [directImageGenError, setDirectImageGenError] = useState<string | null>(null);
    const [directImageAspectRatio, setDirectImageAspectRatio] = useState<string>('1:1');
    const [directImageArtisticStyle, setDirectImageArtisticStyle] = useState<string>('none');
    const [selectedPreset, setSelectedPreset] = useState<string>('');
    
    // State for live example showcase
    const [liveExample, setLiveExample] = useState(liveExamplePrompts[0]);
    const [isFading, setIsFading] = useState(false);
    const [isLiveExampleCopied, setIsLiveExampleCopied] = useState(false);
    const liveExampleIndexRef = useRef(0);


    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const userInputOnMicStartRef = useRef('');

    useEffect(() => {
        // This effect runs once on mount to initialize the AI client
        try {
            initializeAiClient();
            setInitializationError(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during initialization.";
            setInitializationError(errorMessage);
        } finally {
            setIsInitializing(false);
        }
    }, []); // Empty dependency array ensures it runs only once

    useEffect(() => {
        try {
            localStorage.setItem('promptHistory', JSON.stringify(history));
        } catch (error) {
            console.error("Could not save history to localStorage", error);
        }
    }, [history]);
    
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSpeechSupport(false);
            return;
        }
        setSpeechSupport(true);

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognitionRef.current = recognition;

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map((result) => result[0])
                .map((result) => result.transcript)
                .join('');
            
            const startValue = userInputOnMicStartRef.current;
            const separator = startValue && !startValue.endsWith(' ') ? ' ' : '';
            setUserInput(startValue + separator + transcript);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setError(`Speech recognition error: ${event.error}. Please check microphone permissions and try again.`);
            setIsListening(false);
        };

        return () => {
            recognitionRef.current?.stop();
        };
    }, []);
    
    // Effect for live example showcase
    useEffect(() => {
        const interval = setInterval(() => {
            setIsFading(true); // Start fade out
            setTimeout(() => {
                liveExampleIndexRef.current = (liveExampleIndexRef.current + 1) % liveExamplePrompts.length;
                setLiveExample(liveExamplePrompts[liveExampleIndexRef.current]);
                setIsFading(false); // Start fade in
            }, 500); // Wait for fade out to complete
        }, 3000); // Change every 3 seconds

        return () => clearInterval(interval);
    }, []);

    const templates = defaultPromptTemplates;
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    
    const categories = useMemo(() => ['All', ...new Set(templates.map(t => t.category))], [templates]);
    const filteredTemplates = useMemo(() => {
        if (selectedCategory === 'All') return templates;
        return templates.filter(t => t.category === selectedCategory);
    }, [templates, selectedCategory]);
    
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
        const defaultTemplate = templates.find(t => t.isDefault) || templates[0];
        return defaultTemplate.id;
    });

    useEffect(() => {
        if (filteredTemplates.length > 0 && !filteredTemplates.find(t => t.id === selectedTemplateId)) {
            const newDefault = filteredTemplates.find(t => t.isDefault) || filteredTemplates[0];
            setSelectedTemplateId(newDefault.id);
        }
    }, [filteredTemplates, selectedTemplateId]);

    const handleEnhanceClick = useCallback(async () => {
        const trimmedInput = userInput.trim();
        if (!trimmedInput || isLoading) return;

        const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
        if (!selectedTemplate) {
            setError("Invalid template selected.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setEnhancedPromptPro('');
        setEnhancedPromptFlash('');
        setOriginalPrompt(trimmedInput);
        setGeneratedImage(null);
        setImageGenerationError(null);
        
        try {
            if (isComparing) {
                const [resultPro, resultFlash] = await Promise.all([
                    enhancePrompt(trimmedInput, selectedTemplate.template, 'gemini-2.5-pro'),
                    enhancePrompt(trimmedInput, selectedTemplate.template, 'gemini-2.5-flash')
                ]);
                setEnhancedPromptPro(resultPro);
                setEnhancedPromptFlash(resultFlash);
                 setHistory(prevHistory => {
                    const newHistoryItem = { id: Date.now(), original: trimmedInput, enhanced: resultPro, templateName: selectedTemplate.name };
                    const filteredHistory = prevHistory.filter(item => item.original !== trimmedInput);
                    const updatedHistory = [newHistoryItem, ...filteredHistory];
                    return updatedHistory.slice(0, 10);
                });

            } else {
                const result = await enhancePrompt(trimmedInput, selectedTemplate.template, 'gemini-2.5-pro');
                setEnhancedPromptPro(result);
                setHistory(prevHistory => {
                    const newHistoryItem = { id: Date.now(), original: trimmedInput, enhanced: result, templateName: selectedTemplate.name };
                    const filteredHistory = prevHistory.filter(item => item.original !== trimmedInput);
                    const updatedHistory = [newHistoryItem, ...filteredHistory];
                    return updatedHistory.slice(0, 10);
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [userInput, isLoading, selectedTemplateId, templates, isComparing]);
    
    const handleToggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            userInputOnMicStartRef.current = userInput;
            recognitionRef.current?.start();
        }
        setIsListening(!isListening);
    };

    const handleCorrectText = async () => {
        const trimmedInput = userInput.trim();
        if (!trimmedInput || isCorrecting || isLoading) return;

        setIsCorrecting(true);
        setError(null);
        try {
            const corrected = await correctText(trimmedInput);
            setUserInput(corrected);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while correcting text.";
            setError(errorMessage);
        } finally {
            setIsCorrecting(false);
        }
    };
    
    const handleGenerateImage = async () => {
        if (!enhancedPromptPro || isGeneratingImage) return;

        setIsGeneratingImage(true);
        setGeneratedImage(null);
        setImageGenerationError(null);
        
        const finalPrompt = applyArtisticStyle(enhancedPromptPro, imageArtisticStyle);

        try {
            const imageDataUrl = await generateImageFromPrompt(finalPrompt, imageAspectRatio);
            setGeneratedImage(imageDataUrl);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while generating the image.";
            setImageGenerationError(errorMessage);
        } finally {
            setIsGeneratingImage(false);
        }
    };
    
    const handleDirectImageGeneration = async () => {
        const trimmedPrompt = imageGenPrompt.trim();
        if (!trimmedPrompt || isGeneratingDirectImage) return;

        setIsGeneratingDirectImage(true);
        setDirectGeneratedImage(null);
        setDirectImageGenError(null);
        
        const finalPrompt = applyArtisticStyle(trimmedPrompt, directImageArtisticStyle);

        try {
            const imageDataUrl = await generateImageFromPrompt(finalPrompt, directImageAspectRatio);
            setDirectGeneratedImage(imageDataUrl);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while generating the image.";
            setDirectImageGenError(errorMessage);
        } finally {
            setIsGeneratingDirectImage(false);
        }
    };

    const currentTemplateDescription = templates.find(t => t.id === selectedTemplateId)?.description;
    
    const handlePresetChange = (value: string) => {
        setSelectedPreset(value);
        const selected = presetPrompts.find(p => p.name === value);
        if (selected) {
            setImageGenPrompt(selected.prompt);
        } else {
            setImageGenPrompt('');
        }
    };

    const getAspectRatioClass = (ratio: string) => {
        switch (ratio) {
            case '16:9': return 'aspect-video';
            case '9:16': return 'aspect-[9/16]';
            case '1:1':
            default: return 'aspect-square';
        }
    };
    
    const handleCopyLiveExample = useCallback(() => {
        navigator.clipboard.writeText(liveExample);
        setIsLiveExampleCopied(true);
        setTimeout(() => setIsLiveExampleCopied(false), 2000);
    }, [liveExample]);

    if (isInitializing) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
                <SpinnerIcon className="w-16 h-16 text-brand-indigo animate-spin mb-6" />
                <h1 className="text-4xl font-bold font-display text-brand-text-primary">Initializing PromptMatrix Core...</h1>
                <p className="text-lg text-brand-text-secondary mt-2">Connecting to the AI backbone.</p>
            </div>
        );
    }
    
    if (initializationError) {
        return (
             <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
                <div className="w-full max-w-2xl p-8 bg-brand-surface rounded-2xl border border-red-500/50 backdrop-blur-xl">
                    <h1 className="text-4xl font-bold font-display text-red-400">Initialization Failed</h1>
                    <p className="text-lg text-brand-text-secondary mt-4">
                        Could not connect to the Gemini API. This usually means the API key is missing or invalid.
                    </p>
                    <div className="mt-6 p-4 bg-black/30 rounded-lg text-left font-mono text-red-300/80 text-sm overflow-x-auto">
                        <code>Error: {initializationError}</code>
                    </div>
                     <p className="text-sm text-brand-text-secondary/60 mt-6">
                        Please ensure your environment is correctly configured with a valid API key and refresh the page. The API key is managed by the environment and cannot be set within the app.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="min-h-screen p-4 flex flex-col items-center relative overflow-x-hidden"
        >
             <div className="absolute top-4 right-4 flex gap-2 z-20">
                 <button
                    onClick={() => setIsFeedbackVisible(true)}
                    className="p-2 bg-brand-surface/80 border border-brand-border backdrop-blur-xl rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Send Feedback"
                >
                    <EnvelopeIcon className="w-6 h-6" />
                </button>
                 <button
                    onClick={() => setIsHistoryVisible(true)}
                    className="p-2 bg-brand-surface/80 border border-brand-border backdrop-blur-xl rounded-full hover:bg-white/10 transition-colors"
                    aria-label="View history"
                >
                    <HistoryIcon className="w-6 h-6" />
                </button>
            </div>
            
            <Header />

            <main className="w-full max-w-7xl mx-auto flex flex-col items-center flex-grow z-10">
                <div className="w-full max-w-3xl p-6 bg-brand-surface rounded-2xl border border-brand-border backdrop-blur-xl dot-grid-bg animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex flex-col space-y-4">
                        <div className="relative">
                            <label htmlFor="prompt-input" className="text-sm font-medium text-brand-text-secondary mb-2 block">Enter your prompt idea</label>
                            <textarea
                                id="prompt-input"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="e.g., 'a cat in a library' or 'library mein ek billi'"
                                rows={4}
                                className="w-full p-4 pr-24 bg-black/20 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-indigo/80 focus:outline-none transition-all duration-200 text-brand-text-primary placeholder-brand-text-secondary/50 resize-none font-mono text-base"
                                disabled={isLoading || isCorrecting}
                            />
                            <div className="absolute bottom-4 right-4 flex items-center gap-2">
                                <button 
                                    onClick={handleCorrectText}
                                    disabled={isLoading || isCorrecting || !userInput.trim()}
                                    className="p-2 rounded-full bg-white/5 text-brand-text-secondary hover:bg-white/10 hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Correct spelling and grammar"
                                >
                                    {isCorrecting ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <WandIcon className="w-5 h-5" />}
                                </button>
                                {speechSupport && (
                                    <button 
                                        onClick={handleToggleListening}
                                        disabled={isLoading || isCorrecting}
                                        className={`p-2 rounded-full transition-all duration-300 ${
                                            isListening 
                                            ? 'bg-brand-indigo text-white ring-2 ring-brand-indigo' 
                                            : 'bg-white/5 text-brand-text-secondary hover:bg-white/10 hover:text-white'
                                        }`}
                                        aria-label={isListening ? 'Stop listening' : 'Start listening'}
                                    >
                                        <MicrophoneIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                            <div className="text-right text-xs text-brand-text-secondary/70 mt-1 pr-1">{userInput.length} characters</div>
                        </div>

                         <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-brand-text-secondary mb-2">
                                <TemplateIcon className="w-4 h-4" />
                                Enhancement Template
                            </label>
                             <div className="flex flex-wrap gap-2 mb-3">
                                {categories.map(cat => (
                                    <button 
                                        key={cat} 
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-4 py-1.5 text-sm rounded-full transition-all duration-200 ${selectedCategory === cat ? 'bg-white/10 text-white font-semibold ring-1 ring-brand-border' : 'text-brand-text-secondary hover:bg-white/5 hover:text-white'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                             <CustomSelect
                                id="template-select"
                                value={selectedTemplateId}
                                onChange={setSelectedTemplateId}
                                disabled={isLoading}
                                options={filteredTemplates.map(template => ({ value: template.id, label: template.name }))}
                            />
                             {currentTemplateDescription && (
                                <p className="text-sm text-brand-text-secondary/80 mt-2 pl-1">{currentTemplateDescription}</p>
                             )}
                        </div>

                         <div className="flex items-center justify-between flex-wrap gap-4 text-brand-text-secondary pt-2">
                            <div className="flex items-center gap-2 flex-wrap text-sm h-8">
                                {/* Placeholder for future quick actions */}
                            </div>
                             <label htmlFor="compare-toggle" className="flex items-center cursor-pointer select-none">
                                <span className="mr-3 text-sm font-medium text-brand-text-primary">Compare Models</span>
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        id="compare-toggle" 
                                        className="sr-only" 
                                        checked={isComparing} 
                                        onChange={() => setIsComparing(!isComparing)} 
                                        disabled={isLoading}
                                    />
                                    <div className={`block w-12 h-6 rounded-full transition-colors ${isComparing ? 'bg-brand-indigo' : 'bg-white/10'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isComparing ? 'translate-x-6' : ''}`}></div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <button
                        onClick={handleEnhanceClick}
                        disabled={isLoading || !userInput.trim() || isCorrecting}
                        className="w-full mt-6 flex items-center justify-center gap-3 px-6 py-4 text-lg font-bold font-display text-white bg-gradient-to-r from-brand-indigo to-brand-magenta rounded-lg transition-all duration-300 disabled:opacity-50 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transform hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)] active:scale-100 focus:outline-none focus:ring-4 focus:ring-brand-magenta/50"
                    >
                        {isLoading ? (
                            <>
                                <SpinnerIcon className="w-6 h-6 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-6 h-6" />
                                Generate Matrix
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mt-6 w-full max-w-3xl p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-center animate-fade-in-up">
                        {error}
                    </div>
                )}
                
                <div className="w-full mt-8">
                    {(originalPrompt || isLoading) && !error && (
                        <div className={`w-full grid grid-cols-1 ${isComparing ? 'lg:grid-cols-3' : 'md:grid-cols-2'} gap-6 animate-fade-in-up`} style={{ animationDelay: '300ms' }}>
                             {isLoading ? (
                                <>
                                    <LoadingSkeleton />
                                    <LoadingSkeleton />
                                    {isComparing && <LoadingSkeleton />}
                                </>
                            ) : (
                                <>
                                    <PromptOutput title="Original Prompt" prompt={originalPrompt} />
                                    <PromptOutput 
                                        title={isComparing ? "Gemini 2.5 Pro" : "Enhanced Matrix"} 
                                        prompt={enhancedPromptPro} 
                                        isEnhanced={true}
                                        onGenerateImage={handleGenerateImage}
                                        isGeneratingImage={isGeneratingImage}
                                    />
                                    {isComparing && (
                                        <PromptOutput 
                                            title="Gemini 2.5 Flash" 
                                            prompt={enhancedPromptFlash} 
                                            isEnhanced={true}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {(isGeneratingImage || generatedImage || imageGenerationError) && (
                    <div className="w-full max-w-3xl mt-8 p-6 bg-brand-surface rounded-2xl border border-brand-border backdrop-blur-xl animate-fade-in-up">
                        <h3 className="text-xl font-bold text-brand-text-primary mb-4 text-center font-display">Generated Image (from Enhanced Matrix)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto mb-6">
                            <ArtisticStyleSelector
                                id="enhanced-image-style-select"
                                selectedStyle={imageArtisticStyle}
                                onSelect={setImageArtisticStyle}
                                disabled={isGeneratingImage}
                            />
                            <AspectRatioSelector
                                id="enhanced-image-ratio-select"
                                selectedRatio={imageAspectRatio}
                                onSelect={setImageAspectRatio}
                                disabled={isGeneratingImage}
                            />
                        </div>
                        <div className="flex justify-center items-center flex-col">
                            {isGeneratingImage && (
                                <div className={`w-full max-w-md ${getAspectRatioClass(imageAspectRatio)} shimmer-bg rounded-lg`}></div>
                            )}
                            {imageGenerationError && (
                                <div className="w-full p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-center">
                                    <p className="font-bold mb-2">Image Generation Failed</p>
                                    <p>{imageGenerationError}</p>
                                </div>
                            )}
                            {generatedImage && (
                                <div className={`relative group w-full max-w-md ${getAspectRatioClass(imageAspectRatio)}`}>
                                    <img src={generatedImage} alt="AI Generated from prompt" className="rounded-lg shadow-lg w-full h-full object-cover" />
                                    <a 
                                        href={generatedImage} 
                                        download="generated-image.png"
                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 text-white text-lg font-semibold p-4 bg-black/50 rounded-lg backdrop-blur-sm">
                                            <DownloadIcon className="w-6 h-6" />
                                            Download Image
                                        </div>
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="w-full max-w-3xl mx-auto my-12 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                    <div className="w-full p-6 bg-brand-surface rounded-2xl border border-brand-border backdrop-blur-xl dot-grid-bg">
                        <h2 className="text-3xl font-bold text-center mb-2 font-display text-transparent bg-clip-text bg-gradient-to-r from-brand-magenta to-brand-indigo">AI Image Creator</h2>
                        <p className="text-center text-brand-text-secondary mb-6">Directly interface with the image generation core.</p>
                        
                        <div className="text-center mb-6">
                            <p className="text-sm text-brand-text-secondary mb-2">Need inspiration?</p>
                            <div className="relative p-3 bg-black/20 border border-brand-border rounded-lg flex items-center justify-between gap-2">
                                <p className={`text-brand-text-primary text-sm text-left font-mono transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
                                    {liveExample}
                                </p>
                                <button
                                    onClick={handleCopyLiveExample}
                                    className="p-2 rounded-md bg-white/5 hover:bg-white/10 text-brand-text-secondary hover:text-white transition-colors flex-shrink-0"
                                    aria-label="Copy example prompt"
                                >
                                    {isLiveExampleCopied ? <CheckIcon className="w-4 h-4 text-brand-magenta" /> : <ClipboardIcon className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto mb-6">
                            <ArtisticStyleSelector
                                id="direct-image-style-select"
                                selectedStyle={directImageArtisticStyle}
                                onSelect={setDirectImageArtisticStyle}
                                disabled={isGeneratingDirectImage}
                            />
                            <AspectRatioSelector
                                id="direct-image-ratio-select"
                                selectedRatio={directImageAspectRatio}
                                onSelect={setDirectImageAspectRatio}
                                disabled={isGeneratingDirectImage}
                            />
                        </div>

                        <div className="flex flex-col space-y-4">
                            <div>
                                <label htmlFor="preset-select" className="text-sm font-medium text-brand-text-secondary mb-2 block">Start with a Preset (Optional)</label>
                                <CustomSelect
                                    id="preset-select"
                                    placeholder="Select a preset..."
                                    value={selectedPreset}
                                    onChange={handlePresetChange}
                                    disabled={isGeneratingDirectImage}
                                    options={presetPrompts.map(p => ({ value: p.name, label: p.name }))}
                                />
                            </div>
                            <textarea
                                value={imageGenPrompt}
                                onChange={(e) => setImageGenPrompt(e.target.value)}
                                placeholder="e.g., A photorealistic image of a wolf howling at a neon moon..."
                                rows={3}
                                className="w-full p-4 bg-black/20 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-indigo/80 focus:outline-none transition-all duration-200 text-brand-text-primary placeholder-brand-text-secondary/50 resize-y font-mono text-base"
                                disabled={isGeneratingDirectImage}
                            />
                            <button
                                onClick={handleDirectImageGeneration}
                                disabled={isGeneratingDirectImage || !imageGenPrompt.trim()}
                                className="w-full flex items-center justify-center gap-3 px-6 py-3 text-lg font-bold font-display text-white bg-gradient-to-r from-brand-indigo to-brand-magenta rounded-lg transition-all duration-300 disabled:opacity-50 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-100 focus:outline-none focus:ring-4 focus:ring-brand-magenta/50"
                            >
                                {isGeneratingDirectImage ? (
                                    <>
                                        <SpinnerIcon className="w-6 h-6 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon className="w-6 h-6" />
                                        Generate Image
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {(isGeneratingDirectImage || directGeneratedImage || directImageGenError) && (
                        <div className="w-full mt-8 p-6 bg-brand-surface rounded-2xl border-brand-border backdrop-blur-xl animate-fade-in-up">
                            <div className="flex justify-center items-center flex-col">
                                {isGeneratingDirectImage && (
                                    <div className={`w-full max-w-md ${getAspectRatioClass(directImageAspectRatio)} shimmer-bg rounded-lg`}></div>
                                )}
                                {directImageGenError && (
                                    <div className="w-full p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-center">
                                        <p className="font-bold mb-2">Image Generation Failed</p>
                                        <p>{directImageGenError}</p>
                                    </div>
                                )}
                                {directGeneratedImage && (
                                    <div className={`relative group w-full max-w-md ${getAspectRatioClass(directImageAspectRatio)}`}>
                                        <img src={directGeneratedImage} alt="AI Generated from prompt" className="rounded-lg shadow-lg w-full h-full object-cover" />
                                        <a 
                                            href={directGeneratedImage} 
                                            download="generated-image.png"
                                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 text-white text-lg font-semibold p-4 bg-black/50 rounded-lg backdrop-blur-sm">
                                                <DownloadIcon className="w-6 h-6" />
                                                Download Image
                                            </div>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <FeedbackModal 
                isOpen={isFeedbackVisible}
                onClose={() => setIsFeedbackVisible(false)}
            />
            <HistoryModal 
                isOpen={isHistoryVisible}
                onClose={() => setIsHistoryVisible(false)}
                history={history}
                onSelectPrompt={(prompt) => {
                    setUserInput(prompt);
                    setIsHistoryVisible(false);
                }}
                templates={templates}
            />
        </div>
    );
};

export default App;