import * as State from './state.js';
import * as UI from './ui.js';
import * as GameLogic from './gameLogic.js';
import { MINER_TYPES_DATA, INITIAL_DIGITAL_CANVAS } from './config.js';

export function handleSaveGame() {
    try {
        const gameStateData = State.exportGameState();
        const jsonData = JSON.stringify(gameStateData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'CmdCrafter_Save.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        UI.displayMessage("Game state saved to CmdCrafter_Save.json.", "system-message");
        UI.displayMessage("Current operational parameters archived.", "voice-output");
    } catch (error) {
        UI.displayMessage("Error saving game data.", "error-message");
        console.error("Save game error:", error);
    }
}

export async function handleLoadGame() {
    return new Promise((resolve, reject) => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';

        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                UI.displayMessage(`Loading game from ${file.name}...`, "system-message");
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const fileContent = e.target.result;
                        const saveData = JSON.parse(fileContent);
                        
                        GameLogic.stopResourceGeneration(); // Stop current game activities
                        State.importGameState(saveData); // Import the new state

                        // Clear most of the output except for user inputs and loading messages
                        const outputElem = document.getElementById('output');
                        const messagesToKeep = Array.from(outputElem.children).filter(
                            child => child.classList.contains('user-input') || child.textContent.startsWith('Loading game...')
                        ).slice(-5); // Keep a bit more context for loading messages
                        
                        outputElem.innerHTML = ''; 
                        messagesToKeep.forEach(msg => outputElem.appendChild(msg));

                        UI.displayMessage("Game loaded successfully from file.", "system-message");
                        UI.displayMessage("System state restored. Resuming operations.", "voice-output");
                        
                        UI.updateStatusDisplay(State.getAP(), State.getPlayerLevel(), State.getCurrentXP(), State.getXPToNextLevel(), State.getResources());
                        UI.populateMinerTypesInfo(MINER_TYPES_DATA, State.getPlayerLevel());
                        
                        // UI adjustments based on game state
                        if (State.getGameState() === 'GAMEPLAY') {
                            if (UI.isMinerTypesInfoVisible()) UI.hideMinerTypesInfo();
                        } else if (State.getGameState().startsWith('SETUP_')) {
                             if (!UI.isMinerTypesInfoVisible()) UI.showMinerTypesInfo();
                        }


                        if (State.getActiveMiners().length > 0) {
                            GameLogic.startResourceGeneration();
                        }
                        
                        UI.getCommandInputElement().disabled = false;
                        UI.focusCommandInput();
                        GameLogic.updateXPNeededForNextLevel(); 
                        State.clearTempMinerOrder(); // Clear any pending miner setup from previous state

                        resolve();
                    } catch (error) {
                        UI.displayMessage("Error loading game: Invalid save file or corrupted data.", "error-message");
                        console.error("Load game error:", error);
                        reject(error);
                    } finally {
                        document.body.removeChild(fileInput);
                    }
                };
                reader.onerror = (err) => {
                    UI.displayMessage("Error reading file.", "error-message");
                    console.error("File read error:", err);
                    document.body.removeChild(fileInput);
                    reject(err);
                };
                reader.readAsText(file);
            } else {
                UI.displayMessage("Load game operation cancelled.", "info-message");
                document.body.removeChild(fileInput);
                resolve(); 
            }
        });

        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        // UI.displayMessage("Loading game... Please select your save file.", "system-message"); // Moved to when file is selected
        fileInput.click();
    });
}