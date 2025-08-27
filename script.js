import * as UI from './ui.js';
import * as State from './state.js';
import * as GameLogic from './gameLogic.js';
import * as Commands from './commands.js';
import { BASE_GAMEPLAY_COMMANDS, BACKGROUND_MUSIC_PATH } from './config.js'; // For simple command check

let audioCtx;
let typingBuffer;
const TYPING_SOUND_PATH = '/keypress_sound.mp3';
let gameContainerElem;
let backgroundMusicElem;

async function initAudio() {
    return new Promise((resolve) => {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            const typingSoundPromise = fetch(TYPING_SOUND_PATH)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch typing sound: ${response.statusText}`);
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
                .then(buffer => {
                    typingBuffer = buffer;
                    console.log("Typing sound loaded.");
                })
                .catch(err => {
                    console.warn("Typing sound loading failed:", err);
                    // Resolve even on failure, game can proceed without this sound.
                });

            const backgroundMusicPromise = new Promise((resMusic) => {
                backgroundMusicElem = document.getElementById('background-music');
                if (backgroundMusicElem) {
                    backgroundMusicElem.src = BACKGROUND_MUSIC_PATH;
                    
                    const onCanPlayThrough = () => {
                        console.log("Background music can play through.");
                        cleanupListeners();
                        resMusic();
                    };
                    const onError = (e) => {
                        console.warn("Background music loading error:", e);
                        cleanupListeners();
                        resMusic(); // Resolve even on failure
                    };
                    const cleanupListeners = () => {
                        backgroundMusicElem.removeEventListener('canplaythrough', onCanPlayThrough);
                        backgroundMusicElem.removeEventListener('error', onError);
                    };

                    backgroundMusicElem.addEventListener('canplaythrough', onCanPlayThrough);
                    backgroundMusicElem.addEventListener('error', onError);
                    
                    // For some browsers, 'loadstart' or 'loadedmetadata' might be needed before 'canplaythrough'
                    // but usually just setting src and calling load() is enough.
                    backgroundMusicElem.load(); // Explicitly call load after setting src and listeners.
                } else {
                    console.warn("Background music element not found.");
                    resMusic(); // Resolve if element is missing
                }
            });
            
            Promise.all([typingSoundPromise, backgroundMusicPromise])
                .then(() => {
                    console.log("All audio assets attempted to load.");
                    
                    const resumeAudio = () => {
                        if (audioCtx && audioCtx.state === 'suspended') {
                            audioCtx.resume().then(() => {
                                console.log("AudioContext resumed successfully.");
                                if (backgroundMusicElem && backgroundMusicElem.HAVE_ENOUGH_DATA === backgroundMusicElem.readyState && backgroundMusicElem.paused) {
                                    backgroundMusicElem.play().catch(e => console.warn("Background music play failed post-resume:", e));
                                }
                            }).catch(e => console.error("Error resuming AudioContext:", e));
                        } else if (audioCtx && audioCtx.state === 'running') {
                             if (backgroundMusicElem && backgroundMusicElem.HAVE_ENOUGH_DATA === backgroundMusicElem.readyState && backgroundMusicElem.paused) {
                                backgroundMusicElem.play().catch(e => console.warn("Background music play failed on already running context:", e));
                            }
                        }
                    };

                    if (audioCtx.state === 'suspended') {
                        UI.displayMessage("Click or press any key to enable audio and start music.", "info-message");
                        // These listeners are for resuming the AudioContext and starting music
                        // They are attached after loading screen is gone and game has started.
                        document.addEventListener('click', resumeAudio, { once: true });
                        document.addEventListener('keydown', resumeAudio, { once: true });
                    } else if (audioCtx.state === 'running') {
                        // If context is already running, try to play music if ready
                         if (backgroundMusicElem && backgroundMusicElem.HAVE_ENOUGH_DATA === backgroundMusicElem.readyState && backgroundMusicElem.paused) {
                           backgroundMusicElem.play().catch(e => console.warn("Background music play failed on init (context running):", e));
                        }
                    }
                    resolve(); // Resolve the main initAudio promise
                })
                .catch(error => { // Should ideally not be hit if sub-promises handle their own errors and resolve.
                    console.warn("Critical error during audio asset loading group:", error);
                    resolve(); 
                });

        } catch (e) {
            console.warn("Web Audio API initialization failed overall.", e);
            audioCtx = null; 
            resolve(); // Resolve main promise even if AudioContext itself fails.
        }
    });
}

function playTypingSound() {
    if (!audioCtx || !typingBuffer || audioCtx.state !== 'running') return;

    const source = audioCtx.createBufferSource();
    source.buffer = typingBuffer;
    source.connect(audioCtx.destination);
    source.start();
}

document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'flex';

    UI.initUI();
    gameContainerElem = document.getElementById('game-container');
    
    try {
        await initAudio();
        console.log("Audio initialization process finished.");
    } catch (error) {
        // This catch is for if initAudio itself throws an unhandled rejection, 
        // though we've made it resolve in most cases.
        console.error("Core audio initialization failed:", error);
        UI.displayMessage("Audio system encountered a critical failure. Sounds may be unavailable.", "error-message");
    }
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    
    GameLogic.startGame();

    let currentActivePredictions = [];
    let selectedPredictionUIIndex = -1;

    function clearPredictions() {
        currentActivePredictions = [];
        selectedPredictionUIIndex = -1;
        UI.clearPredictionsUI();
    }

    function updatePredictions() {
        const inputText = UI.getCommandInputValue();
        if (inputText.trim() === '' && State.getGameState() !== 'SETUP_ALLOCATE') {
            clearPredictions();
            return;
        }
        currentActivePredictions = Commands.getRelevantCommands(inputText);
        selectedPredictionUIIndex = currentActivePredictions.length > 0 ? 0 : -1;
        UI.updatePredictionsUIDisplay(currentActivePredictions, selectedPredictionUIIndex, handlePredictionClick);
    }

    async function processAndClearCommand() {
        const commandStr = UI.getCommandInputValue();
        clearPredictions();
        if (commandStr.trim() !== '') {
            await Commands.processUserCommand(commandStr);
        }
        UI.clearCommandInput();
        updatePredictions(); // Update predictions for potentially new state
    }
    
    function handlePredictionClick(predictionText) {
        let newInputValue = predictionText;
        const simpleCommands = [...BASE_GAMEPLAY_COMMANDS, 'CRAFT_THE_END', 'done_setup', 'craft the end', 'delete system32', 'SKIP_INTRO']; // Add setup/initial commands

        if (simpleCommands.map(cmd => cmd.toUpperCase().split(" ")[0]).includes(predictionText.split(" ")[0].toUpperCase()) && !predictionText.includes("<")) {
            UI.setCommandInputValue(predictionText.trim());
            processAndClearCommand(); // No await needed here as it's a click event
            return;
        } else if (!predictionText.includes(" ") && !predictionText.includes("<") && !predictionText.endsWith('"') && !predictionText.endsWith('>')) {
            newInputValue += ' ';
        }
        
        UI.setCommandInputValue(newInputValue);
        UI.focusCommandInput();
        updatePredictions();
    }

    const commandInputElem = UI.getCommandInputElement();
    commandInputElem.addEventListener('input', updatePredictions);

    commandInputElem.addEventListener('keydown', async (event) => {
        // Typing sound logic
        const isCharInput = event.key.length === 1; // Catches letters, numbers, symbols, space
        const isBackspaceOrDelete = event.key === 'Backspace' || event.key === 'Delete';
        // Check if it's a modifier key *being pressed alone*
        const isModifierKeyAlone = ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key);

        if ((isCharInput || isBackspaceOrDelete) && 
            !isModifierKeyAlone && // don't play for Shift, Ctrl if pressed alone
            !event.ctrlKey && !event.metaKey && !event.altKey // don't play for Ctrl+C, Alt+F etc.
           ) {
            playTypingSound();
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            if (selectedPredictionUIIndex !== -1 && currentActivePredictions[selectedPredictionUIIndex]) {
                // Check if the selected prediction is a full command that should not be modified further
                const selectedText = currentActivePredictions[selectedPredictionUIIndex];
                 const simpleCommands = [...BASE_GAMEPLAY_COMMANDS, 'CRAFT_THE_END', 'done_setup', 'craft the end', 'delete system32', 'SKIP_INTRO', 'LOAD_GAME', 'SAVE_GAME'];
                const isSimple = simpleCommands.some(cmd => selectedText.toUpperCase().startsWith(cmd.toUpperCase()) && !selectedText.includes("<"));

                if (isSimple || !selectedText.includes("<")) {
                    UI.setCommandInputValue(selectedText.trim());
                } else {
                    // For templates, user might have filled it partially, so keep their input if it matches start of template.
                    // This logic might need refinement based on desired behavior for template completion.
                    // For now, using the full prediction is simpler.
                     UI.setCommandInputValue(selectedText);
                }
            }
            await processAndClearCommand();
        } else if (event.key === 'Tab') {
            event.preventDefault();
            if (currentActivePredictions.length > 0) {
                const selectedIndex = selectedPredictionUIIndex !== -1 ? selectedPredictionUIIndex : 0;
                let completion = currentActivePredictions[selectedIndex];
                
                let newInputValue = completion;
                // Broader list of simple commands that don't need a space after tab completion if fully formed
                const simpleCommandsNoSpaceAfter = [...BASE_GAMEPLAY_COMMANDS, 'CRAFT_THE_END', 'done_setup', 'craft the end', 'delete system32'];

                const commandPart = completion.split(" ")[0].toUpperCase();
                if (!completion.includes(" ") && !completion.includes("<") && !completion.endsWith('"') && !completion.endsWith('>') && 
                    !simpleCommandsNoSpaceAfter.map(cmd => cmd.toUpperCase()).includes(commandPart)) {
                    newInputValue += ' ';
                }

                UI.setCommandInputValue(newInputValue);
                updatePredictions();
                UI.focusCommandInput();
            }
        } else if (event.key === 'ArrowDown') {
            if (currentActivePredictions.length > 0) {
                event.preventDefault();
                selectedPredictionUIIndex = (selectedPredictionUIIndex + 1) % currentActivePredictions.length;
                UI.updatePredictionsUIDisplay(currentActivePredictions, selectedPredictionUIIndex, handlePredictionClick);
            }
        } else if (event.key === 'ArrowUp') {
            if (currentActivePredictions.length > 0) {
                event.preventDefault();
                selectedPredictionUIIndex = (selectedPredictionUIIndex - 1 + currentActivePredictions.length) % currentActivePredictions.length;
                UI.updatePredictionsUIDisplay(currentActivePredictions, selectedPredictionUIIndex, handlePredictionClick);
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            clearPredictions();
        }
    });

    // Mouse follow effect
    document.addEventListener('mousemove', (event) => {
        if (!gameContainerElem) return;

        const { clientX, clientY } = event;
        const { innerWidth, innerHeight } = window;

        const xOffset = (clientX / innerWidth - 0.5) * 2; // -1 to 1
        const yOffset = (clientY / innerHeight - 0.5) * 2; // -1 to 1

        const MAX_ROTATION = 1.5; // Max degrees of rotation
        const MAX_TRANSLATE = 5; // Max pixels of translation
        const MAX_SCALE_EFFECT = 0.005; // Max scale change (e.g. 1.005)

        // Apply subtle transformations
        // Using CSS variables can make this cleaner if preferred, but direct style is fine.
        gameContainerElem.style.transform = `
            perspective(2000px)
            translateX(${xOffset * MAX_TRANSLATE * -1}px) 
            translateY(${yOffset * MAX_TRANSLATE * -1}px) 
            rotateX(${yOffset * MAX_ROTATION * -1}deg) 
            rotateY(${xOffset * MAX_ROTATION}deg)
            scale(${1 + Math.abs(xOffset * yOffset) * MAX_SCALE_EFFECT}) 
         `;
        // Simplified for just translate to avoid text blurriness from rotate/scale on some browsers
         gameContainerElem.style.transform = `
           translateX(${xOffset * MAX_TRANSLATE * -1}px) 
           translateY(${yOffset * MAX_TRANSLATE * -1}px)
           scale(${1 + (Math.abs(xOffset) + Math.abs(yOffset)) * 0.001})
        `;

    });
});