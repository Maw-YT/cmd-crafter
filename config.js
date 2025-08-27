export const MINER_COST = 5;

export const MINER_TYPES_DATA = {
    "Coal": { resource: "Coal", description: "raw data", tier: 1, levelRequired: 1 },
    "Iron": { resource: "Iron", description: "structural data", tier: 1, levelRequired: 1 },
    "Tin": { resource: "Tin", description: "light data", tier: 1, levelRequired: 1 },
    "Copper": { resource: "Copper", description: "conductive data", tier: 1, levelRequired: 1 },
    "Memory": { resource: "_Memory", description: "generates _Memory", tier: 1, levelRequired: 1 },
    "LogicBit": { resource: "_LogicBit", description: "generates _LogicBit", tier: 1, levelRequired: 1 },
    "XPMiner": { resource: "_XPFragment", description: "slowly cultivates raw experience", tier: 1, levelRequired: 1 },
    "Diamond": { resource: "Diamond", description: "compressed data", tier: 2, levelRequired: 3 },
    "Entropy": { resource: "_Entropy", description: "generates _Entropy", tier: 2, levelRequired: 3 },
    "Metaphor": { resource: "_Metaphor", description: "generates _Metaphor", tier: 2, levelRequired: 4 },
    "Echoes": { resource: "_Echoes", description: "generates _Echoes", tier: 2, levelRequired: 4 },
    "Int32": { resource: "Int32", description: "specific computational units", tier: 3, levelRequired: 5 },
    "Dogecoin": { resource: "Dogecoin", description: "conceptual 'value' units", tier: 3, levelRequired: 6 },
    "Bitcoin": { resource: "Bitcoin", description: "conceptual 'value' units", tier: 3, levelRequired: 6 },
    "Solar": { resource: "Solar", description: "digital 'energy' units", tier: 3, levelRequired: 5 },
    "Big64": { resource: "Big64", description: "advanced computational units", tier: 4, levelRequired: 7 }
};

// Helper to get all mineable resources for the end game recipe
export function getMineableResourcesForEndGame() {
    const resources = new Set();
    for (const type in MINER_TYPES_DATA) {
        if (MINER_TYPES_DATA[type].resource !== "_XPFragment") {
            resources.add(MINER_TYPES_DATA[type].resource);
        }
    }
    return Array.from(resources);
}

export const SELLABLE_RESOURCES = {
    "Coal": { valuePerLot: 1, lotSize: 10 },
    "Iron": { valuePerLot: 1, lotSize: 10 },
    "Tin": { valuePerLot: 1, lotSize: 10 },
    "Copper": { valuePerLot: 1, lotSize: 10 },
    "GlimmeringDust": { valuePerLot: 5, lotSize: 1 },
    "CorruptedDataChunk": { valuePerLot: 2, lotSize: 1 }
};

export const INITIAL_DIGITAL_CANVAS = {
    CORE_NEXUS: { components: [], description: "The central point of the emerging reality." },
    DATA_SEA: { components: [], description: "A vast ocean of raw information, ready to be shaped." },
    LOGIC_MATRIX: { components: [], description: "The foundational grid for computational structures."}
};

export const BASE_GAMEPLAY_COMMANDS = ['SYNTHESIZE', 'INJECT', 'OBSERVE', 'SELL', 'LIST_MINERS', 'LIST_MODULES', 'LIST_RESOURCES', 'LIST_TARGET_AREAS', 'MINER_TYPES', 'HELP', 'CRAFT_THE_END', 'SAVE_GAME', 'LOAD_GAME', 'TOGGLE_OBSERVE_AI', 'CLEAR'];

export const END_GAME_ITEMS_FROM_OBSERVATION = [ 
    "FragmentOfCreation",
    "SeedOfPotential",
    "WhisperOfReality",
    "EchoOfTime",
    "NexusCrystal"
];

export const OBSERVATION_SELLABLE_ITEMS = {
    "GlimmeringDust": { valuePerLot: 5, lotSize: 1 },
    "CorruptedDataChunk": { valuePerLot: 2, lotSize: 1 }
};

export const OBSERVE_COOLDOWN_DURATION = 30000; // 30 seconds in milliseconds
export const BACKGROUND_MUSIC_PATH = '/background_music.mp3'; // Corrected path

// New configuration for Local AI (Ollama via LiteLLM)
export const LOCAL_AI_ENABLED = true; // Set to false to disable local AI calls (though no fallback is implemented here)
export const LOCAL_AI_ENDPOINT = 'http://localhost:8000/v1/chat/completions'; // Default LiteLLM OpenAI-compatible endpoint
export const LOCAL_AI_MODEL = 'ollama/mistral'; // User-specified model, e.g., "ollama/deepseek-coder" or the specific "deepseek-r1"