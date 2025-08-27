import { INITIAL_DIGITAL_CANVAS } from './config.js';

let ap = 10;
let playerLevel = 1;
let currentXP = 0;
let xpToNextLevel = 100;
let resources = {};
let activeMiners = [];
let gameState = 'AWAITING_CHOICE';
let tempMinerOrder = {};
let conversationHistory = [];
let synthesizedModules = {};
let digitalCanvas = JSON.parse(JSON.stringify(INITIAL_DIGITAL_CANVAS)); // Deep copy
let observeCooldowns = {}; // { [areaName]: timestamp }
let areaObservationStatus = {}; // { [areaName]: 'can_find_items' | 'nothing_pending_inject' }
let useAIForObserve = true; // Default to true

export function getAP() { return ap; }
export function setAP(value) { ap = value; }
export function spendAP(amount) { ap -= amount; }

export function getPlayerLevel() { return playerLevel; }
export function setPlayerLevel(value) { playerLevel = value; }
export function incrementPlayerLevel() { playerLevel++; }

export function getCurrentXP() { return currentXP; }
export function setCurrentXP(value) { currentXP = value; }
export function addXP(amount) { currentXP += amount; }

export function getXPToNextLevel() { return xpToNextLevel; }
export function setXPToNextLevel(value) { xpToNextLevel = value; }

export function getResources() { return { ...resources }; }
export function getResource(name) { return resources[name]; }
export function addResource(name, amount) { resources[name] = (resources[name] || 0) + amount; }
export function removeResource(name, amount) {
    if (resources[name]) {
        resources[name] -= amount;
        if (resources[name] <= 0) {
            delete resources[name];
        }
    }
}
export function setResources(newResources) { resources = { ...newResources }; }

export function getActiveMiners() { return [...activeMiners]; }
export function addActiveMiner(miner) { activeMiners.push(miner); }

export function getGameState() { return gameState; }
export function setGameState(newState) { gameState = newState; }

export function getTempMinerOrder() { return { ...tempMinerOrder }; }
export function setTempMinerOrder(order) { tempMinerOrder = { ...order }; }
export function updateTempMinerOrder(update) { tempMinerOrder = { ...tempMinerOrder, ...update}; }
export function clearTempMinerOrder() { tempMinerOrder = {}; }

export function getConversationHistory() { return [...conversationHistory]; }
export function addMessageToConversationHistory(message) {
    conversationHistory.push(message);
    conversationHistory = conversationHistory.slice(-10); // Keep last 10
}

export function getSynthesizedModules() { return { ...synthesizedModules }; }
export function addSynthesizedModule(name, moduleData) { synthesizedModules[name] = moduleData; }

export function getDigitalCanvas() { return JSON.parse(JSON.stringify(digitalCanvas)); } // Deep copy
export function getDigitalCanvasArea(areaName) {
    return digitalCanvas[areaName] ? JSON.parse(JSON.stringify(digitalCanvas[areaName])) : undefined;
}
export function addComponentToCanvasArea(areaName, componentName) {
    if (digitalCanvas[areaName]) {
        digitalCanvas[areaName].components.push(componentName);
    }
}

export function getObserveCooldowns() { return { ...observeCooldowns }; }
export function setObserveCooldown(areaName, timestamp) { observeCooldowns[areaName] = timestamp; }

export function getAreaObservationStatus(areaName) { return areaObservationStatus[areaName]; }
export function setAreaObservationStatus(areaName, status) { areaObservationStatus[areaName] = status; }
export function resetAreaObservationStatus(areaName) { areaObservationStatus[areaName] = 'can_find_items'; }

export function getUseAIForObserve() { return useAIForObserve; }
export function setUseAIForObserve(value) { useAIForObserve = value; }

export function isGameOver() { return gameState === 'GAME_OVER'; }

export function exportGameState() {
    return {
        ap: getAP(),
        playerLevel: getPlayerLevel(),
        currentXP: getCurrentXP(),
        xpToNextLevel: getXPToNextLevel(),
        resources: getResources(),
        activeMiners: getActiveMiners(),
        synthesizedModules: getSynthesizedModules(),
        digitalCanvas: getDigitalCanvas(),
        gameState: getGameState(),
        conversationHistory: getConversationHistory(),
        observeCooldowns: getObserveCooldowns(),
        areaObservationStatus: { ...areaObservationStatus }, // Export the whole object
        useAIForObserve: getUseAIForObserve()
    };
}

export function importGameState(data) {
    setAP(data.ap || 10);
    setPlayerLevel(data.playerLevel || 1);
    setCurrentXP(data.currentXP || 0);
    setXPToNextLevel(data.xpToNextLevel || 100); // Or recalculate based on level
    setResources(data.resources || {});
    
    // Clear existing and set new active miners
    activeMiners = []; 
    if (data.activeMiners && Array.isArray(data.activeMiners)) {
        data.activeMiners.forEach(miner => addActiveMiner(miner));
    }

    synthesizedModules = {};
    if (data.synthesizedModules && typeof data.synthesizedModules === 'object') {
        Object.entries(data.synthesizedModules).forEach(([name, moduleData]) => {
            addSynthesizedModule(name, moduleData);
        });
    }
    
    digitalCanvas = data.digitalCanvas ? JSON.parse(JSON.stringify(data.digitalCanvas)) : JSON.parse(JSON.stringify(INITIAL_DIGITAL_CANVAS));
    setGameState(data.gameState || 'AWAITING_CHOICE');

    observeCooldowns = data.observeCooldowns || {};
    areaObservationStatus = data.areaObservationStatus || {};
    // Ensure all canvas areas have an initial observation status if not present in save data
    Object.keys(INITIAL_DIGITAL_CANVAS).forEach(areaName => {
        if (!areaObservationStatus[areaName]) {
            areaObservationStatus[areaName] = 'can_find_items';
        }
    });

    setUseAIForObserve(data.useAIForObserve === undefined ? true : data.useAIForObserve);

    conversationHistory = [];
    if (data.conversationHistory && Array.isArray(data.conversationHistory)) {
        data.conversationHistory.forEach(msg => addMessageToConversationHistory(msg));
    } else { // ensure a minimal history if none is saved
         addMessageToConversationHistory({
            role: "system",
            content: "You are the disembodied voice in the Cmd Crafter game. The player is a nascent AI crafting a new digital reality. When they OBSERVE an area, describe what they see based on the components injected into it. Be descriptive, slightly ominous, and hint at future possibilities. The ultimate goal is 'The End' - a new digital reality. Keep responses concise, 2-3 sentences max."
        });
    }
}

export function initializeGameState() {
    ap = 10;
    playerLevel = 1;
    currentXP = 0;
    xpToNextLevel = 100;
    resources = {};
    activeMiners = [];
    gameState = 'AWAITING_CHOICE';
    tempMinerOrder = {};
    conversationHistory = [];
    synthesizedModules = {};
    digitalCanvas = JSON.parse(JSON.stringify(INITIAL_DIGITAL_CANVAS));
    observeCooldowns = {};
    areaObservationStatus = {};
    useAIForObserve = true; // Initialize to true
    Object.keys(INITIAL_DIGITAL_CANVAS).forEach(areaName => {
        areaObservationStatus[areaName] = 'can_find_items';
    });

    addMessageToConversationHistory({
        role: "system",
        content: "You are the disembodied voice in the Cmd Crafter game. The player is a nascent AI crafting a new digital reality. When they OBSERVE an area, describe what they see based on the components injected into it. Be descriptive, slightly ominous, and hint at future possibilities. The ultimate goal is 'The End' - a new digital reality. Keep responses concise, 2-3 sentences max."
    });
}