import * as State from './state.js';
import * as UI from './ui.js';
import * as GameLogic from './gameLogic.js'; // Keep for any direct calls if necessary, though most logic moves
import * as Persistence from './persistenceCommands.js';
import * as Setup from './setupCommands.js';
import * as Gameplay from './gameplayCommands.js';
import { MINER_TYPES_DATA, INITIAL_DIGITAL_CANVAS, SELLABLE_RESOURCES, BASE_GAMEPLAY_COMMANDS } from './config.js';

export async function processUserCommand(commandStr) {
    UI.displayMessage(`> ${commandStr}`, 'user-input');
    const [command, ...args] = commandStr.trim().split(/\s+/);
    const lowerCommand = command.toLowerCase();

    if (State.isGameOver() && lowerCommand !== 'load_game') {
        UI.displayMessage("Program terminated. No commands accepted except 'LOAD_GAME'.", "error-message");
        return;
    }
    
    // Handle commands that can be run in multiple states or are special
    if (lowerCommand === 'load_game') {
        if (State.isGameOver()) { // Allow loading even if game over, to restart or load a different save
             UI.displayMessage("Attempting to load game from GAME_OVER state...", "system-message");
        }
        await Persistence.handleLoadGame();
        return;
    }
    if (lowerCommand === 'save_game' && (State.getGameState() === 'GAMEPLAY' || State.getGameState().startsWith('SETUP_'))) {
        Persistence.handleSaveGame();
        return;
    }
    if (lowerCommand === 'allocate_ap' && (State.getGameState() === 'SETUP_ALLOCATE' || State.getGameState() === 'GAMEPLAY')) {
        Setup.handleAllocateAP(commandStr);
        return;
    }

    // State-specific command routing
    switch (State.getGameState()) {
        case 'AWAITING_CHOICE':
            // LOAD_GAME is handled above, SAVE_GAME is not applicable
            // Initial choices are handled by setupCommands
            if (lowerCommand !== 'save_game') { // save_game has no meaning here
                 Setup.handleInitialChoice(commandStr.trim().toLowerCase());
            } else {
                UI.displayMessage("Cannot save game before starting.", "error-message");
            }
            break;
        case 'SETUP_ALLOCATE': // ALLOCATE_AP is handled above
            if (lowerCommand !== 'allocate_ap' && lowerCommand !== 'save_game' && lowerCommand !== 'load_game') {
                 UI.displayMessage("Invalid command for current state. Use ALLOCATE_AP or LOAD/SAVE.", "error-message");
            }
            break;
        case 'SETUP_DEFINE_TYPE':
             if (lowerCommand === 'define_miner_type') {
                Setup.handleDefineMinerType(commandStr);
            } else if (lowerCommand !== 'save_game' && lowerCommand !== 'load_game') {
                UI.displayMessage("Invalid command for current state. Use DEFINE_MINER_TYPE or LOAD/SAVE.", "error-message");
            }
            break;
        case 'SETUP_DEPLOY_SCRIPT':
            if (lowerCommand === 'deploy_miner_script' || lowerCommand === 'done_setup') {
                Setup.handleDeployMinerScript(args, commandStr);
            } else if (lowerCommand !== 'save_game' && lowerCommand !== 'load_game') {
                 UI.displayMessage("Invalid command for current state. Use DEPLOY_MINER_SCRIPT, DEPLOY_MINER_SCRIPT AUTO, done_setup or LOAD/SAVE.", "error-message");
            }
            break;
        case 'GAMEPLAY':
            // ALLOCATE_AP, SAVE_GAME, LOAD_GAME are handled above
            if (lowerCommand !== 'allocate_ap' && lowerCommand !== 'save_game' && lowerCommand !== 'load_game') {
                await Gameplay.routeGameplayCommand(lowerCommand, args, commandStr);
            }
            break;
        default:
            UI.displayMessage(`Error: Unknown game state ${State.getGameState()}`, "error-message");
    }
}

export function getRelevantCommands(inputText) {
    const inputNormalized = inputText.toUpperCase().trim();
    const parts = inputNormalized.split(/\s+/);
    const firstWordFull = parts[0];
    let suggestions = [];
    const currentGameState = State.getGameState();
    const playerLevel = State.getPlayerLevel();

    let commandPool = [];

    if (currentGameState === 'AWAITING_CHOICE') {
        commandPool = ['craft the end', 'delete system32', 'LOAD_GAME', 'SKIP_INTRO'];
        suggestions = commandPool.filter(cmd => cmd.toUpperCase().startsWith(inputNormalized));
    } else {
        // Define command pools for different states
        const universalSetupCommands = ['LOAD_GAME', 'SAVE_GAME'];
        switch (currentGameState) {
            case 'SETUP_ALLOCATE': 
                commandPool = ['ALLOCATE_AP', ...universalSetupCommands]; 
                break;
            case 'SETUP_DEFINE_TYPE': 
                commandPool = ['DEFINE_MINER_TYPE', ...universalSetupCommands]; 
                break;
            case 'SETUP_DEPLOY_SCRIPT': 
                commandPool = ['DEPLOY_MINER_SCRIPT', 'done_setup', ...universalSetupCommands]; 
                break;
            case 'GAMEPLAY': 
                // Add ALLOCATE_AP to the gameplay command pool
                commandPool = ['ALLOCATE_AP', ...BASE_GAMEPLAY_COMMANDS, ...universalSetupCommands]; 
                break; 
            default: // Fallback, should ideally not be hit
                commandPool = ['ALLOCATE_AP', ...BASE_GAMEPLAY_COMMANDS, ...universalSetupCommands];
        }
        // Ensure unique commands if BASE_GAMEPLAY_COMMANDS was added multiple times or contains universal commands
        commandPool = [...new Set(commandPool)];

        if (inputNormalized === "" && currentGameState === 'SETUP_ALLOCATE') {
            suggestions.push('ALLOCATE_AP <amount> FOR MINER_TEMPLATE');
        } else if (parts.length === 1 && !inputText.endsWith(" ")) {
            // Suggest commands starting with the first word
            suggestions = commandPool.filter(cmd => cmd.toUpperCase().startsWith(firstWordFull));
        } else if (parts.length >= 1 && commandPool.map(c => c.split(" ")[0].toUpperCase()).includes(firstWordFull)) {
            // First word matches a known command, suggest completions or arguments
            const currentMainCmd = firstWordFull;

            if (currentMainCmd === 'DEFINE_MINER_TYPE' && (currentGameState === 'SETUP_DEFINE_TYPE' || currentGameState === 'GAMEPLAY')) { // Added GAMEPLAY for consistency if ever allowed
                if (parts.length === 1 && inputText.endsWith(" ")) {
                    suggestions.push(`${currentMainCmd} "`);
                } else if (parts.length > 1 && parts[1].startsWith('"')) {
                    const partialName = inputText.substring(inputText.toUpperCase().indexOf('"') + 1).toUpperCase();
                    Object.keys(MINER_TYPES_DATA)
                        .filter(name => MINER_TYPES_DATA[name].levelRequired <= playerLevel && name.toUpperCase().startsWith(partialName))
                        .forEach(name => suggestions.push(`${currentMainCmd} "${name}"`));
                }
            } else if (currentMainCmd === 'ALLOCATE_AP' && (currentGameState === 'SETUP_ALLOCATE' || currentGameState === 'GAMEPLAY')) {
                 if (inputText.endsWith(" ") && parts.length < 5) { // Suggest template if space at end and not too many parts
                    suggestions.push(`${currentMainCmd} <amount> FOR MINER_TEMPLATE`);
                } else if (parts.length === 2 && !isNaN(parseInt(parts[1])) && inputText.endsWith(" ")) {
                    suggestions.push(`${inputText.trim()} FOR MINER_TEMPLATE`);
                } else if (parts.length === 3 && parts[2].toUpperCase() === "FOR" && inputText.endsWith(" ")) {
                     suggestions.push(`${inputText.trim()} MINER_TEMPLATE`);
                }
            } else if (currentMainCmd === 'DEPLOY_MINER_SCRIPT' && currentGameState === 'SETUP_DEPLOY_SCRIPT') {
                if (parts.length === 1 && inputText.endsWith(" ")) { // e.g. "DEPLOY_MINER_SCRIPT "
                    suggestions.push(`${currentMainCmd} <name.sh>`);
                    suggestions.push(`${currentMainCmd} AUTO`);
                } else if (parts.length === 2) { // e.g. "DEPLOY_MINER_SCRIPT A" or "DEPLOY_MINER_SCRIPT my_"
                    if ("AUTO".startsWith(parts[1].toUpperCase())) {
                        suggestions.push(`${currentMainCmd} AUTO`);
                    }
                    // No specific suggestion for partial <name.sh> here, but it could be added.
                    // The initial `<name.sh>` template is shown if only a space is after the command.
                }
            } else if (currentMainCmd === 'SYNTHESIZE' && currentGameState === 'GAMEPLAY') {
                if (inputText.endsWith(" ")) {
                    suggestions.push(`${currentMainCmd} <Resource1> <Resource2> AS <NewModule>`);
                }
            } else if (currentMainCmd === 'INJECT' && currentGameState === 'GAMEPLAY') {
                if (parts.length === 1 && inputText.endsWith(" ")) { 
                    suggestions.push(`${currentMainCmd} <Module> INTO <TargetArea>`);
                } else if (parts.length === 2 && inputText.endsWith(" ")) { 
                    suggestions.push(`${inputText.trim()} INTO `);
                } else if (parts.length === 4 && parts[2].toUpperCase() === "INTO" && inputText.endsWith(" ")) { 
                    Object.keys(INITIAL_DIGITAL_CANVAS).forEach(area => suggestions.push(`${inputText.trim()}${area}`));
                } else if (parts.length === 4 && parts[2].toUpperCase() === "INTO") {
                     const partialArea = parts[3].toUpperCase();
                     Object.keys(INITIAL_DIGITAL_CANVAS)
                        .filter(area => area.toUpperCase().startsWith(partialArea))
                        .forEach(area => suggestions.push(`${parts.slice(0,3).join(" ")} ${area}`));
                }
            } else if (currentMainCmd === 'OBSERVE' && currentGameState === 'GAMEPLAY') {
                if (parts.length === 1 && inputText.endsWith(" ")) {
                    Object.keys(INITIAL_DIGITAL_CANVAS).forEach(area => suggestions.push(`${currentMainCmd} ${area}`));
                } else if (parts.length === 2) {
                    const partialArea = parts[1].toUpperCase();
                    Object.keys(INITIAL_DIGITAL_CANVAS)
                        .filter(area => area.toUpperCase().startsWith(partialArea))
                        .forEach(area => suggestions.push(`${currentMainCmd} ${area}`));
                }
            } else if (currentMainCmd === 'SELL' && currentGameState === 'GAMEPLAY') {
                if (parts.length === 1 && inputText.endsWith(" ")) {
                    suggestions.push(`${currentMainCmd} <Resource> <Amount>`);
                } else if (parts.length === 2 && inputText.endsWith(" ")) { 
                    const resourceName = parts[1];
                    if(SELLABLE_RESOURCES[resourceName] && SELLABLE_RESOURCES[resourceName].lotSize) {
                        suggestions.push(`${inputText.trim()}${SELLABLE_RESOURCES[resourceName].lotSize}`);
                    } else {
                         Object.keys(SELLABLE_RESOURCES)
                            .filter(res => res.toUpperCase().startsWith(resourceName.toUpperCase()))
                            .forEach(res => suggestions.push(`${currentMainCmd} ${res} <Amount>`));
                        if (suggestions.length === 0) suggestions.push(`${inputText.trim()}<Amount>`);
                    }
                } else if (parts.length === 3) {
                    // Suggest amount if resource is typed and space after
                    const resourceName = parts[1];
                     if(SELLABLE_RESOURCES[resourceName] && SELLABLE_RESOURCES[resourceName].lotSize && inputText.endsWith(" ")) {
                        suggestions.push(`${inputText.trim()}${SELLABLE_RESOURCES[resourceName].lotSize}`);
                    }
                }
            }
             // Add more specific suggestions for other commands if needed
        }
    }
    return [...new Set(suggestions)].slice(0, 5); // Return unique suggestions, max 5
}