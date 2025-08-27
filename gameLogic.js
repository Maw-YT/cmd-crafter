import * as State from './state.js';
import * as UI from './ui.js';
import { MINER_TYPES_DATA, INITIAL_DIGITAL_CANVAS, LOCAL_AI_ENABLED, LOCAL_AI_ENDPOINT, LOCAL_AI_MODEL } from './config.js';

let resourceIntervalId = null;

export function updateXPNeededForNextLevel() {
    State.setXPToNextLevel(State.getPlayerLevel() * 100);
}

export function gainXP(amount) {
    State.addXP(amount);
    while (State.getCurrentXP() >= State.getXPToNextLevel()) {
        State.setCurrentXP(State.getCurrentXP() - State.getXPToNextLevel());
        State.incrementPlayerLevel();
        updateXPNeededForNextLevel();
        UI.displayMessage(`Level up! Reached Level ${State.getPlayerLevel()}. New capabilities may be unlocked.`, "voice-output");
        UI.displayMessage(`Congratulations! You've reached Level ${State.getPlayerLevel()}!`, "info-message");
        UI.populateMinerTypesInfo(MINER_TYPES_DATA, State.getPlayerLevel());
    }
    UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
}

export function generateResources() {
    const activeMiners = State.getActiveMiners();
    if (activeMiners.length === 0) return;

    activeMiners.forEach(miner => {
        State.addResource(miner.resource, miner.rate);
        if (miner.resource === "_XPFragment") {
            const xpFragmentsGenerated = miner.rate; // Assuming rate is per cycle for this miner
            if (State.getResource("_XPFragment") >= xpFragmentsGenerated) { // Check if resource was actually added
                 State.removeResource("_XPFragment", xpFragmentsGenerated); // Consume the fragments
                 gainXP(xpFragmentsGenerated); // Convert directly to XP
                 // UI.displayMessage(`Processed ${xpFragmentsGenerated} _XPFragment(s) into XP.`, "system-message"); // Optional: can be chatty
            }
        }
    });
    UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
}

export function startGame() {
    State.initializeGameState();
    updateXPNeededForNextLevel();
    UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
    UI.populateMinerTypesInfo(MINER_TYPES_DATA, State.getPlayerLevel());
    // Initialize observation status for all areas if not already set (e.g. on new game)
    Object.keys(INITIAL_DIGITAL_CANVAS).forEach(areaName => {
        if (State.getAreaObservationStatus(areaName) === undefined) {
            State.resetAreaObservationStatus(areaName);
        }
    });

    // Check if we are resuming from a load that occurred before this startGame was called (e.g. LOAD_GAME as first command)
    // If gameState is already GAMEPLAY (or other non-AWAITING_CHOICE states), it means a load probably happened.
    if (State.getGameState() === 'AWAITING_CHOICE') {
        UI.displayMessage("Initializing Genesis Protocol... Entity detected.", "voice-output");
        setTimeout(() => {
            UI.displayMessage("What will you do... craft the end or.... delete system32?", "voice-output");
            UI.displayMessage("Type 'craft the end' or 'delete system32'. You can also 'LOAD_GAME'.", "info-message");
        }, 1500);
    } else {
        // Game state is not AWAITING_CHOICE, likely means a game was loaded.
        // UI should have been updated by the load process.
        // Ensure resource generation is active if applicable.
        if (State.getActiveMiners().length > 0 && !resourceIntervalId) {
            startResourceGeneration();
        }
        UI.displayMessage("System sync confirmed. Previous state loaded.", "system-message");
    }
}

export function startResourceGeneration() {
    if (!resourceIntervalId) {
        resourceIntervalId = setInterval(generateResources, 5000);
    }
}

export function stopResourceGeneration() {
    if (resourceIntervalId) {
        clearInterval(resourceIntervalId);
        resourceIntervalId = null;
    }
}

export async function handleLLMObservation(targetAreaName, area) {
    const llmPrompt = `The player observes ${targetAreaName}. Its base description is "${area.description}". It currently contains the following components: ${area.components.join(', ') || 'none'}. Describe what they see.`;
    State.addMessageToConversationHistory({ role: "user", content: llmPrompt });

    try {
        if (!LOCAL_AI_ENABLED) {
            UI.displayMessage("Local AI system is disabled (system config). Observation conduit provides raw data only.", "voice-output");
            // The main handleObserve function in gameplayCommands will proceed with item drops etc.
            // This function's responsibility is only the descriptive text.
            return;
        }

        if (!State.getUseAIForObserve()) {
            UI.displayMessage("Observe AI is currently disabled (user toggle). Observation conduit provides raw data only.", "voice-output");
            // The main handleObserve function will proceed.
            return;
        }
        
        UI.displayMessage("AI analyzing observations (via local service)...", "voice-output");
        
        const payload = {
            model: LOCAL_AI_MODEL,
            messages: State.getConversationHistory(),
            // stream: false, // LiteLLM usually defaults to non-streaming if not specified
        };

        const response = await fetch(LOCAL_AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Authorization header might be needed if LiteLLM is configured with an API key
                // 'Authorization': 'Bearer YOUR_LITELLM_API_KEY', 
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorBody = "Could not retrieve error details.";
            try {
                errorBody = await response.text();
            } catch (e) {
                // ignore if reading body fails
            }
            throw new Error(`Local AI service request failed: ${response.status} ${response.statusText}. Body: ${errorBody}`);
        }

        const completionData = await response.json();
        
        if (!completionData.choices || completionData.choices.length === 0 || !completionData.choices[0].message || !completionData.choices[0].message.content) {
            console.error("Local AI response data:", completionData);
            throw new Error("Local AI service returned an unexpected or incomplete response structure.");
        }
        
        const llmResponseContent = completionData.choices[0].message.content;
        
        UI.displayMessage(llmResponseContent, "voice-output");
        // Construct the message object in the format expected by conversation history
        const assistantMessage = { role: "assistant", content: llmResponseContent };
        State.addMessageToConversationHistory(assistantMessage);

    } catch (error) {
        console.error("Local LLM Error:", error);
        UI.displayMessage("Observation conduits are... fuzzy. Connection to local analysis unit failed or returned an error.", "voice-output");
        UI.displayMessage(`Error: ${error.message}. Ensure your local AI service (e.g., LiteLLM + Ollama with model '${LOCAL_AI_MODEL}') is running and accessible at '${LOCAL_AI_ENDPOINT}'. Check browser console for more details.`, "error-message");
    }
}