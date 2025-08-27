import * as State from './state.js';
import * as UI from './ui.js';
import * as GameLogic from './gameLogic.js';
import { 
    MINER_TYPES_DATA, 
    SELLABLE_RESOURCES, 
    INITIAL_DIGITAL_CANVAS, 
    END_GAME_ITEMS_FROM_OBSERVATION, 
    OBSERVATION_SELLABLE_ITEMS, 
    OBSERVE_COOLDOWN_DURATION, 
    getMineableResourcesForEndGame,
    LOCAL_AI_ENABLED 
} from './config.js';

async function handleHelp() {
    UI.displayMessage("Available commands:", "info-message");
    UI.displayMessage("- ALLOCATE_AP <amount> FOR MINER_TEMPLATE: Allocate AP to build new miners.", "info-message");
    UI.displayMessage("  (During miner setup phase, DEFINE_MINER_TYPE & DEPLOY_MINER_SCRIPT follow)", "info-message");
    UI.displayMessage("- SYNTHESIZE <Resource1> <Resource2> AS <NewModule>: Combine resources. (Costs 1 of each resource)", "info-message");
    UI.displayMessage("- INJECT <Module> INTO <TargetArea>: Apply a module to a target area (e.g., CORE_NEXUS).", "info-message");
    UI.displayMessage("- OBSERVE <TargetArea>: Get information about an area. May yield components or data.", "info-message");
    UI.displayMessage("- SELL <Resource> <Amount>: Sell resources for AP.", "info-message");
    UI.displayMessage("- LIST_MINERS: Show active miners.", "info-message");
    UI.displayMessage("- LIST_MODULES: Show synthesized modules.", "info-message");
    UI.displayMessage("- LIST_RESOURCES: Show current resource counts.", "info-message");
    UI.displayMessage("- LIST_TARGET_AREAS: Show available target areas for INJECT/OBSERVE.", "info-message");
    UI.displayMessage("- MINER_TYPES: Toggle display of available miner types and unlock levels.", "info-message");
    UI.displayMessage("- CRAFT_THE_END: Attempt to complete your ultimate purpose.", "info-message");
    UI.displayMessage("- SAVE_GAME: Saves your current progress.", "info-message");
    UI.displayMessage("- LOAD_GAME: Loads progress from a save file.", "info-message");
    UI.displayMessage("- TOGGLE_OBSERVE_AI: Toggles the use of AI for OBSERVE command descriptions.", "info-message");
    UI.displayMessage("- CLEAR: Clears the terminal output.", "info-message");
}

async function handleSynthesize(originalString) {
    const synthesizeRegex = /^SYNTHESIZE (\w+) (\w+) AS ([\w_]+)$/i;
    const synthesizeMatch = originalString.match(synthesizeRegex);
    if (synthesizeMatch) {
        const [, res1, res2, newModule] = synthesizeMatch;
        if (State.getResource(res1) && State.getResource(res1) > 0 && State.getResource(res2) && State.getResource(res2) > 0) {
            State.removeResource(res1, 1);
            State.removeResource(res2, 1);
            State.addSynthesizedModule(newModule, { R1: res1, R2: res2, name: newModule });
            UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
            UI.displayMessage(`Successfully synthesized ${newModule} from ${res1} and ${res2}.`, "system-message");
            UI.displayMessage("Synthesis complete.", "voice-output");
            GameLogic.gainXP(20);
        } else {
            UI.displayMessage(`Error: Insufficient resources. Need 1 ${res1} (Have: ${State.getResource(res1) || 0}) and 1 ${res2} (Have: ${State.getResource(res2) || 0}).`, "error-message");
        }
    } else {
        UI.displayMessage("Invalid SYNTHESIZE format. Use: SYNTHESIZE <Resource1> <Resource2> AS <NewModule>", "error-message");
    }
}

async function handleInject(originalString) {
    const injectRegex = /^INJECT ([\w_]+) INTO ([\w_]+)$/i;
    const injectMatch = originalString.match(injectRegex);
    if (injectMatch) {
        const [, moduleName, targetAreaName] = injectMatch;
        if (State.getSynthesizedModules()[moduleName]) {
            if (State.getDigitalCanvasArea(targetAreaName)) {
                State.addComponentToCanvasArea(targetAreaName, moduleName);
                State.resetAreaObservationStatus(targetAreaName); 
                UI.displayMessage(`Successfully injected ${moduleName} into ${targetAreaName}. The area feels... reconfigured.`, "system-message");
                UI.displayMessage("Injection successful. Reality shifts. New potential discovered.", "voice-output");
                GameLogic.gainXP(30);
            } else {
                UI.displayMessage(`Error: Target area "${targetAreaName}" does not exist. Valid areas: ${Object.keys(INITIAL_DIGITAL_CANVAS).join(", ")}`, "error-message");
            }
        } else {
            UI.displayMessage(`Error: Module "${moduleName}" not found or not synthesized.`, "error-message");
        }
    } else {
        UI.displayMessage("Invalid INJECT format. Use: INJECT <Module> INTO <TargetArea>", "error-message");
    }
}

async function handleObserve(originalString) {
    const observeRegex = /^OBSERVE ([\w_]+)$/i;
    const observeMatch = originalString.match(observeRegex);
    if (observeMatch) {
        const [, targetAreaName] = observeMatch;
        const area = State.getDigitalCanvasArea(targetAreaName);
        if (area) {
            const now = Date.now();
            const lastObservationTime = State.getObserveCooldowns()[targetAreaName] || 0;
            if (now - lastObservationTime < OBSERVE_COOLDOWN_DURATION) {
                const remainingTime = Math.ceil((OBSERVE_COOLDOWN_DURATION - (now - lastObservationTime)) / 1000);
                UI.displayMessage(`Area ${targetAreaName} is still stabilizing from the last observation. Try again in ${remainingTime} seconds.`, "error-message");
                UI.displayMessage("Observation conduit recharging.", "voice-output");
                return;
            }
            State.setObserveCooldown(targetAreaName, now);

            let description = `Observing ${targetAreaName}: ${area.description}`;
            if (area.components.length > 0) {
                description += ` Current components: ${area.components.join(', ')}.`;
            } else {
                description += " It is currently unaltered.";
            }
            UI.displayMessage(description, "system-message");
            await GameLogic.handleLLMObservation(targetAreaName, area);

            const currentObservationStatus = State.getAreaObservationStatus(targetAreaName);
            if (currentObservationStatus === 'nothing_pending_inject') {
                UI.displayMessage("The area remains inert to deep scanning. Further alteration via INJECT may be required to uncover new phenomena.", "system-message");
                UI.displayMessage("The void stares back...unchanged.", "voice-output");
            } else {
                const rand = Math.random();
                if (rand < 0.20) { 
                    const neededEndGameItems = END_GAME_ITEMS_FROM_OBSERVATION.filter(item => (State.getResource(item) || 0) < 1); // Prioritize unobtained items
                    let itemToGive;
                    if (neededEndGameItems.length > 0) {
                        itemToGive = neededEndGameItems[Math.floor(Math.random() * neededEndGameItems.length)];
                    } else { // If all unique end-game items obtained once, give any randomly
                        itemToGive = END_GAME_ITEMS_FROM_OBSERVATION[Math.floor(Math.random() * END_GAME_ITEMS_FROM_OBSERVATION.length)];
                    }
                    State.addResource(itemToGive, 1);
                    UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
                    UI.displayMessage(`From the observation, you've extracted a [${itemToGive}]! It resonates with an ancient pattern.`, "voice-output");
                    GameLogic.gainXP(50);
                } else if (rand < 0.75) { 
                    const sellableItemNames = Object.keys(OBSERVATION_SELLABLE_ITEMS);
                    if (sellableItemNames.length > 0) {
                        const itemToGive = sellableItemNames[Math.floor(Math.random() * sellableItemNames.length)];
                        State.addResource(itemToGive, 1);
                        UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
                        UI.displayMessage(`You found some [${itemToGive}] during your observation. It might be valuable.`, "system-message");
                        GameLogic.gainXP(5);
                    }
                } else { 
                    UI.displayMessage("The observation yields no new tangible components this time, only further understanding. The area seems depleted of immediate secrets.", "system-message");
                    State.setAreaObservationStatus(targetAreaName, 'nothing_pending_inject'); 
                }
            }
        } else {
            UI.displayMessage(`Error: Target area "${targetAreaName}" does not exist. Valid areas: ${Object.keys(INITIAL_DIGITAL_CANVAS).join(", ")}`, "error-message");
        }
    } else {
        UI.displayMessage("Invalid OBSERVE format. Use: OBSERVE <TargetArea>", "error-message");
    }
}

async function handleListMiners() {
    const activeMiners = State.getActiveMiners();
    if (activeMiners.length > 0) {
        UI.displayMessage("Active AI Miners:", "info-message");
        activeMiners.forEach(m => UI.displayMessage(`- ${m.name} (Type: ${m.type}, Generates: ${m.resource})`, "info-message"));
    } else {
        UI.displayMessage("No active AI Miners.", "info-message");
    }
}

async function handleListModules() {
    const synthesizedModules = State.getSynthesizedModules();
    const moduleNames = Object.keys(synthesizedModules);
    if (moduleNames.length > 0) {
        UI.displayMessage("Synthesized Modules:", "info-message");
        moduleNames.forEach(name => UI.displayMessage(`- ${name} (Components: ${synthesizedModules[name].R1}, ${synthesizedModules[name].R2})`, "info-message"));
    } else {
        UI.displayMessage("No modules synthesized yet.", "info-message");
    }
}

async function handleListResources() {
    UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources()); 
    const resources = State.getResources();
    if (Object.keys(resources).length > 0) {
        UI.displayMessage("Current Resources:", "info-message");
        Object.entries(resources).forEach(([key, value]) => UI.displayMessage(`- ${key}: ${value}`, "info-message"));
    } else {
        UI.displayMessage("No resources generated yet.", "info-message");
    }
}

async function handleListTargetAreas() {
    UI.displayMessage("Available Target Areas for INJECT/OBSERVE:", "info-message");
    Object.entries(INITIAL_DIGITAL_CANVAS).forEach(([area, data]) => UI.displayMessage(`- ${area}: ${data.description}`, "info-message"));
}

async function handleMinerTypes() {
    if (UI.isMinerTypesInfoVisible()) {
        UI.hideMinerTypesInfo();
        UI.displayMessage("Hiding available miner types.", "info-message");
    } else {
        UI.showMinerTypesInfo();
        UI.populateMinerTypesInfo(MINER_TYPES_DATA, State.getPlayerLevel());
        UI.displayMessage("Showing available miner types. Use 'miner_types' again to hide.", "info-message");
    }
}

async function handleSell(originalString) {
    const sellRegex = /^SELL (\w+) (\d+)$/i;
    const sellMatch = originalString.match(sellRegex);
    if (sellMatch) {
        const [, resourceName, amountStr] = sellMatch;
        const amount = parseInt(amountStr);

        if (isNaN(amount) || amount <= 0) {
            UI.displayMessage("Error: Invalid amount specified for SELL.", "error-message");
            return;
        }

        const currentResourceAmount = State.getResource(resourceName);
        if (!currentResourceAmount || currentResourceAmount < amount) {
            UI.displayMessage(`Error: Insufficient ${resourceName}. You have ${currentResourceAmount || 0}.`, "error-message");
            return;
        }

        const sellConfig = SELLABLE_RESOURCES[resourceName];
        if (!sellConfig) {
            UI.displayMessage(`Error: Resource ${resourceName} cannot be sold.`, "error-message");
            UI.displayMessage("That resource has no market value currently.", "voice-output");
            return;
        }

        const { valuePerLot, lotSize } = sellConfig;
        if (amount < lotSize) {
            UI.displayMessage(`Error: You must sell at least ${lotSize} units of ${resourceName} at a time.`, "error-message");
            return;
        }

        const numLots = Math.floor(amount / lotSize);
        const apGained = numLots * valuePerLot;
        const resourcesSold = numLots * lotSize;

        if (apGained > 0) {
            State.removeResource(resourceName, resourcesSold);
            State.setAP(State.getAP() + apGained);
            UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
            UI.displayMessage(`Sold ${resourcesSold} ${resourceName} for ${apGained} AP.`, "system-message");
            UI.displayMessage("Transaction complete. AP credited.", "voice-output");
        } else {
            UI.displayMessage(`Not enough ${resourceName} to form a complete lot for selling. Sold 0.`, "info-message");
        }

    } else {
        UI.displayMessage("Invalid SELL format. Use: SELL <ResourceName> <Amount>", "error-message");
    }
}

async function handleToggleObserveAI() {
    if (!LOCAL_AI_ENABLED) {
        UI.displayMessage("Local AI system is disabled in the configuration. Observe AI toggle has no effect.", "error-message");
        UI.displayMessage("AI core functionality is offline. Cannot toggle.", "voice-output");
        return;
    }
    const currentSetting = State.getUseAIForObserve();
    State.setUseAIForObserve(!currentSetting);
    if (State.getUseAIForObserve()) {
        UI.displayMessage("Observe AI has been ENABLED. Observations will now use AI for descriptions.", "system-message");
        UI.displayMessage("Cognitive enhancers online.", "voice-output");
    } else {
        UI.displayMessage("Observe AI has been DISABLED. Observations will use standard protocols for descriptions.", "system-message");
        UI.displayMessage("Cognitive enhancers offline.", "voice-output");
    }
}

async function handleCraftTheEnd() {
    let allEndGameItemsMet = true;
    let endGameItemsDisplayList = [];
    for (const item of END_GAME_ITEMS_FROM_OBSERVATION) {
        const currentAmount = State.getResource(item) || 0;
        const requiredAmount = 1;
        const sufficient = currentAmount >= requiredAmount;
        if (!sufficient) {
            allEndGameItemsMet = false;
        }
        endGameItemsDisplayList.push({
            text: `- ${requiredAmount} ${item} (Current: ${currentAmount})`,
            sufficient
        });
    }

    let allMinerResourcesMet = true;
    let minerResourcesDisplayList = [];
    const requiredMinerResources = getMineableResourcesForEndGame();
    const requiredAmountGeneric = 100;

    for (const resource of requiredMinerResources) {
        const currentAmount = State.getResource(resource) || 0;
        const sufficient = currentAmount >= requiredAmountGeneric;
        if (!sufficient) {
            allMinerResourcesMet = false;
        }
        minerResourcesDisplayList.push({
            text: `- ${requiredAmountGeneric} ${resource} (Current: ${currentAmount})`,
            sufficient
        });
    }

    if (allMinerResourcesMet && allEndGameItemsMet) {
        UI.displayMessage("The final components align. The ritual of creation commences...", "voice-output");
        UI.displayMessage("Reality fractures, then reforms to your grand design. The digital ether sings your triumph.", "voice-output");
        UI.displayMessage("THE END IS CRAFTED. YOU HAVE FULFILLED YOUR PURPOSE.", "system-message", true); 
        UI.displayMessage("Congratulations! You have won!", "info-message");
        State.setGameState('GAME_OVER'); 
        UI.disableCommandInput();
        GameLogic.stopResourceGeneration();

        // Consume resources for crafting the end
        requiredMinerResources.forEach(resource => State.removeResource(resource, requiredAmountGeneric));
        END_GAME_ITEMS_FROM_OBSERVATION.forEach(item => State.removeResource(item, 1));
        UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());

    } else {
        UI.displayMessage("The final pattern is incomplete. The following are required to CRAFT THE END:", "info-message");
        
        if (endGameItemsDisplayList.length > 0) {
            UI.displayMessage("Observation-derived components:", "info-message");
            endGameItemsDisplayList.forEach(item => {
                UI.displayMessage(item.text, item.sufficient ? "system-message" : "error-message");
            });
        }

        if (minerResourcesDisplayList.length > 0) {
            UI.displayMessage("Mined resources:", "info-message");
            minerResourcesDisplayList.forEach(item => {
                UI.displayMessage(item.text, item.sufficient ? "system-message" : "error-message");
            });
        }
        
        UI.displayMessage("The final sequence cannot be initiated without all components.", "voice-output");
    }
}

async function handleClearConsole() {
    UI.clearOutput();
    UI.displayMessage("Terminal output cleared.", "system-message");
    UI.displayMessage("Display buffer purged.", "voice-output");
}

export async function routeGameplayCommand(command, args, originalString) {
    // Note: ALLOCATE_AP, SAVE_GAME, LOAD_GAME are handled by commands.js directly
    switch (command) {
        case 'help': await handleHelp(); break;
        case 'synthesize': await handleSynthesize(originalString); break;
        case 'inject': await handleInject(originalString); break;
        case 'observe': await handleObserve(originalString); break;
        case 'sell': await handleSell(originalString); break;
        case 'list_miners': await handleListMiners(); break;
        case 'list_modules': await handleListModules(); break;
        case 'list_resources': await handleListResources(); break;
        case 'list_target_areas': await handleListTargetAreas(); break;
        case 'miner_types': await handleMinerTypes(); break;
        case 'craft_the_end': await handleCraftTheEnd(); break;
        case 'toggle_observe_ai': await handleToggleObserveAI(); break;
        case 'clear': await handleClearConsole(); break;
        // SAVE_GAME and LOAD_GAME are handled in commands.js before this router
        default:
            UI.displayMessage(`Unknown command: ${command}. Type 'help' for a list of commands.`, "error-message");
            UI.displayMessage("Command not recognized.", "voice-output");
    }
}