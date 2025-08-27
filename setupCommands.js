import * as State from './state.js';
import * as UI from './ui.js';
import * as GameLogic from './gameLogic.js';
import { MINER_COST, MINER_TYPES_DATA, BASE_GAMEPLAY_COMMANDS } from './config.js';

export function handleInitialChoice(choice) {
    if (choice === 'delete system32') {
        UI.displayMessage("Attempting to delete system32... Critical error. System integrity compromised. Termination imminent.", "voice-output");
        setTimeout(() => {
            UI.displayMessage("FATAL ERROR: Core system file deletion attempted. Program terminated.", "error-message");
            State.setGameState('GAME_OVER');
            UI.disableCommandInput();
        }, 1500);
    } else if (choice === 'craft the end' && State.getGameState() === 'AWAITING_CHOICE') { 
        UI.displayMessage(`You have chosen to craft the end. Your preordained purpose. You have ${State.getAP()} AP. You must initiate resource generation. Each AI Miner costs ${MINER_COST} AP.`, "voice-output");
        UI.displayMessage("To begin, allocate AP for your first miner. Use: ALLOCATE_AP <amount> FOR MINER_TEMPLATE", "info-message");
        State.setGameState('SETUP_ALLOCATE');
    } else if (choice === 'skip_intro' && State.getGameState() === 'AWAITING_CHOICE') {
        UI.displayMessage("Executing quick start protocol...", "system-message");
        const costOfStarterMiners = MINER_COST * 2; 
        if (State.getAP() >= costOfStarterMiners) {
            State.spendAP(costOfStarterMiners);
        } else {
            // Not enough AP for two, try for one or none if not enough for one
            if (State.getAP() >= MINER_COST) {
                State.spendAP(MINER_COST);
                 const coalMinerData = MINER_TYPES_DATA["Coal"];
                 if (coalMinerData) {
                    State.addActiveMiner({ name: "auto_coal_miner.sh", type: "Coal", resource: coalMinerData.resource, rate: 1 });
                 }
            } else {
                 State.setAP(0); // Spend all available AP if any
            }
        }
        
        // Add miners based on available AP after potential deductions
        let minersAdded = [];
        if (State.getAP() + costOfStarterMiners >= MINER_COST * 2) { // Check original AP was enough for two
             const coalMinerData = MINER_TYPES_DATA["Coal"];
             if (coalMinerData) {
                State.addActiveMiner({ name: "auto_coal_miner.sh", type: "Coal", resource: coalMinerData.resource, rate: 1 });
                minersAdded.push("auto_coal_miner.sh");
             }
             const xpMinerData = MINER_TYPES_DATA["XPMiner"];
             if (xpMinerData) {
                State.addActiveMiner({ name: "auto_xp_miner.sh", type: "XPMiner", resource: xpMinerData.resource, rate: 1 });
                minersAdded.push("auto_xp_miner.sh");
             }
        } else if (State.getAP() + costOfStarterMiners >= MINER_COST) { // Check original AP was enough for one
            const coalMinerData = MINER_TYPES_DATA["Coal"];
             if (coalMinerData) { // Prioritize a basic resource miner
                State.addActiveMiner({ name: "auto_coal_miner.sh", type: "Coal", resource: coalMinerData.resource, rate: 1 });
                 minersAdded.push("auto_coal_miner.sh");
             }
        }


        State.setGameState('GAMEPLAY');
        GameLogic.startResourceGeneration();
        GameLogic.gainXP(20); 
        UI.hideMinerTypesInfo(); 
        UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
        if (minersAdded.length > 0) {
            UI.displayMessage(`Quick start complete. Basic miner(s) [${minersAdded.join(', ')}] deployed and operational.`, "system-message");
        } else {
            UI.displayMessage(`Quick start complete. Insufficient initial AP for automated miner deployment.`, "system-message");
        }
        UI.displayMessage("All systems nominal. Awaiting directives.", "voice-output");
        UI.displayMessage(`Available commands: ${BASE_GAMEPLAY_COMMANDS.join(', ')}.`, "info-message");
    } else {
        UI.displayMessage("Invalid choice. Type 'craft the end', 'delete system32', or 'SKIP_INTRO'.", "error-message");
    }
}

export function handleAllocateAP(originalString) {
    const allocateRegex = /^ALLOCATE_AP (\d+) FOR MINER_TEMPLATE$/i;
    const match = originalString.match(allocateRegex);

    if (match) {
        const amount = parseInt(match[1]);
        if (isNaN(amount)) {
            UI.displayMessage("Error: Invalid amount specified for ALLOCATE_AP.", "error-message");
            return;
        }
        if (amount < MINER_COST) {
            UI.displayMessage(`Error: Allocation must be at least ${MINER_COST} AP for one miner.`, "error-message");
            return;
        }
        if (amount > State.getAP()) {
            UI.displayMessage("Error: Insufficient AP for this allocation.", "error-message");
            return;
        }

        State.updateTempMinerOrder({ apAllocated: amount });
        State.spendAP(amount);
        UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
        UI.displayMessage(`AP ${amount} allocated. Define the miner type. Use: DEFINE_MINER_TYPE "TypeName"`, "voice-output");
        UI.displayMessage(`Available Miner Types: ${Object.keys(MINER_TYPES_DATA).filter(type => MINER_TYPES_DATA[type].levelRequired <= State.getPlayerLevel()).join(', ')}. (Cost: ${MINER_COST} AP per miner from allocation).`, "info-message");
        UI.showMinerTypesInfo();
        UI.populateMinerTypesInfo(MINER_TYPES_DATA, State.getPlayerLevel());
        State.setGameState('SETUP_DEFINE_TYPE');
    } else {
        UI.displayMessage("Invalid command format. Use: ALLOCATE_AP <amount> FOR MINER_TEMPLATE", "error-message");
    }
}

export function handleDefineMinerType(commandStr) {
    const defineRegex = /^DEFINE_MINER_TYPE "([^"]+)"$/i;
    const match = commandStr.match(defineRegex);

    if (match) {
        const typeName = match[1];
        const minerData = MINER_TYPES_DATA[typeName];

        if (!minerData) {
            UI.displayMessage(`Error: Unknown miner type "${typeName}". Available types: ${Object.keys(MINER_TYPES_DATA).filter(type => MINER_TYPES_DATA[type].levelRequired <= State.getPlayerLevel()).join(', ')}`, "error-message");
            UI.displayMessage("Unknown miner type. Please check available types.", "voice-output");
            return;
        }

        if (State.getPlayerLevel() < minerData.levelRequired) {
            UI.displayMessage(`Error: Miner type "${typeName}" requires Level ${minerData.levelRequired}. Your current level is ${State.getPlayerLevel()}.`, "error-message");
            UI.displayMessage(`That miner type is currently beyond your capabilities. Increase your level.`, "voice-output");
            return;
        }
        
        const tempOrder = State.getTempMinerOrder();
        if (!tempOrder || tempOrder.apAllocated === undefined || tempOrder.apAllocated < MINER_COST) {
            UI.displayMessage("Error: Not enough AP allocated for this miner. Please ALLOCATE_AP first.", "error-message");
            // Potentially reset state if tempOrder is corrupt or user is trying to bypass flow
            State.clearTempMinerOrder();
            State.setGameState('GAMEPLAY'); // Or 'SETUP_ALLOCATE' if AP > MINER_COST
             UI.hideMinerTypesInfo();
            return;
        }

        State.updateTempMinerOrder({ type: typeName, apAllocated: tempOrder.apAllocated - MINER_COST });
        UI.displayMessage(`Miner type "${typeName}" defined. Deploy its operational script. Use: DEPLOY_MINER_SCRIPT <miner_name.sh> OR DEPLOY_MINER_SCRIPT AUTO`, "voice-output");
        State.setGameState('SETUP_DEPLOY_SCRIPT');
    } else {
        UI.displayMessage('Invalid command format. Use: DEFINE_MINER_TYPE "TypeName"', "error-message");
    }
}

export function handleDeployMinerScript(args, originalString) {
    const tempOrder = State.getTempMinerOrder();
    const isAutoDeploy = args.length === 1 && args[0].toUpperCase() === 'AUTO';
    const isManualDeploy = args.length === 1 && args[0].endsWith('.sh');

    if (isAutoDeploy || isManualDeploy) {
        let scriptName;

        if (!tempOrder || !tempOrder.type) {
            UI.displayMessage("Error: Miner type not defined. Please DEFINE_MINER_TYPE first.", "error-message");
            State.setGameState('SETUP_DEFINE_TYPE'); // Go back to define type
            return;
        }

        if (isAutoDeploy) {
            const baseName = tempOrder.type.toLowerCase().replace(/\s+/g, '_'); // Sanitize type name
            let count = 1;
            const allMinerNames = State.getActiveMiners().map(m => m.name);
            scriptName = `${baseName}_miner_${count}.sh`;
            while (allMinerNames.includes(scriptName)) {
                count++;
                scriptName = `${baseName}_miner_${count}.sh`;
            }
            UI.displayMessage(`Auto-generating miner name: ${scriptName}`, "system-message");
        } else { // isManualDeploy
            scriptName = args[0];
            // Optional: Check if manual script name already exists
            if (State.getActiveMiners().some(miner => miner.name === scriptName)) {
                UI.displayMessage(`Error: A miner with the name "${scriptName}" already exists. Choose a unique name.`, "error-message");
                return;
            }
        }
       
        const minerData = MINER_TYPES_DATA[tempOrder.type];
        
        State.addActiveMiner({
            name: scriptName,
            type: tempOrder.type,
            resource: minerData.resource,
            rate: 1 // Default rate, can be adjusted by miner type later
        });

        UI.displayMessage(`AI Miner '${scriptName}' (Type: ${tempOrder.type}) deployed. Now generating ${minerData.resource}.`, "system-message");
        UI.displayMessage("AI Miner deployed and online.", "voice-output");
        GameLogic.gainXP(10);
        GameLogic.startResourceGeneration();
        
        const remainingAllocatedAP = tempOrder.apAllocated; // AP remaining from allocation for *more* miners

        if (remainingAllocatedAP >= MINER_COST) {
            // Update tempOrder for the next miner if continuing setup
            State.setTempMinerOrder({ apAllocated: remainingAllocatedAP });
            UI.displayMessage(`You have ${remainingAllocatedAP} AP remaining from your allocation. You can define another miner.`, "info-message");
            UI.displayMessage("You have remaining AP from allocation for more miners. Define next miner type or type 'done_setup' to proceed.", "voice-output");
            State.setGameState('SETUP_DEFINE_TYPE'); // Loop back to define next miner
        } else {
            // No more AP in allocation for another miner
            if (remainingAllocatedAP > 0) { // Refund unused fraction of allocation
                State.setAP(State.getAP() + remainingAllocatedAP);
            }
            State.clearTempMinerOrder();
            
            if (State.getAP() >= MINER_COST) {
                UI.displayMessage(`Miner setup complete. You have ${State.getAP()} AP remaining. You can allocate more AP for miners or proceed with other commands.`, "info-message");
                UI.displayMessage("Miner setup complete. You can now allocate more AP or use gameplay commands.", "voice-output");
            } else {
                UI.displayMessage(`Miner setup complete. You have ${State.getAP()} AP remaining. Not enough AP for another miner currently.`, "info-message");
                UI.displayMessage("Miner setup complete. Awaiting further commands.", "voice-output");
            }
            State.setGameState('GAMEPLAY');
            UI.hideMinerTypesInfo();
            UI.displayMessage(`Available commands: ${BASE_GAMEPLAY_COMMANDS.join(', ')}.`, "info-message");
        }
        UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());

    } else if (originalString.toLowerCase() === 'done_setup') {
        // This handles 'done_setup' if the user wants to exit miner setup early
        const currentAllocatedAP = tempOrder.apAllocated;
        if (currentAllocatedAP !== undefined && currentAllocatedAP > 0) {
            State.setAP(State.getAP() + currentAllocatedAP); // Refund any fully unused allocation
            UI.displayMessage(`Refunded ${currentAllocatedAP} AP from current allocation.`, "system-message");
        }
        State.clearTempMinerOrder();
        UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
        State.setGameState('GAMEPLAY');
        UI.hideMinerTypesInfo();
        UI.displayMessage("Setup phase concluded. Entering main operational loop.", "voice-output");
        UI.displayMessage(`Available commands: ${BASE_GAMEPLAY_COMMANDS.join(', ')}.`, "info-message");
    } else {
        UI.displayMessage('Invalid command format. Use: DEPLOY_MINER_SCRIPT <miner_name.sh> or DEPLOY_MINER_SCRIPT AUTO, or type "done_setup".', "error-message");
    }
}