import { MINER_COST } from './config.js';

let outputElem, commandInputElem, apValueDisplayElem, resourcesDisplayElem,
    minerTypesInfoDivElem, minerTypesUlElem, levelValueDisplayElem,
    xpValueDisplayElem, xpNextLevelValueDisplayElem, predictionsContainerElem,
    minerCostInfoElem;

export function initUI() {
    outputElem = document.getElementById('output');
    commandInputElem = document.getElementById('command-input');
    apValueDisplayElem = document.getElementById('ap-value');
    resourcesDisplayElem = document.getElementById('resources-display');
    minerTypesInfoDivElem = document.getElementById('miner-types-info');
    minerTypesUlElem = minerTypesInfoDivElem.querySelector('ul');
    minerCostInfoElem = document.getElementById('miner-cost-info');
    levelValueDisplayElem = document.getElementById('level-value');
    xpValueDisplayElem = document.getElementById('xp-value');
    xpNextLevelValueDisplayElem = document.getElementById('xp-next-level-value');
    predictionsContainerElem = document.getElementById('predictions-container');

    if(minerCostInfoElem) minerCostInfoElem.textContent = MINER_COST;
}

export function displayMessage(text, type = 'system-message') {
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    // Temporarily hide to prevent flash of un-animated content if text is long
    // and animation starts after a microtask.
    // Alternatively, don't add to DOM until first char is ready.
    // For simplicity, we'll add it and let it populate.
    outputElem.appendChild(messageDiv);

    let i = 0;
    const speed = 25; // milliseconds per character

    function typeCharacter() {
        if (i < text.length) {
            messageDiv.textContent += text.charAt(i);
            i++;
            // Ensure scrolling happens with each character for longer messages
            outputElem.scrollTop = outputElem.scrollHeight;
            setTimeout(typeCharacter, speed);
        } else {
            // Final scroll ensure, though likely already there
            outputElem.scrollTop = outputElem.scrollHeight;
        }
    }

    if (text && text.length > 0) {
        typeCharacter();
    } else {
        // Handle empty message if necessary, or just let it be.
        // For now, an empty message div will just take up its margin space.
        outputElem.scrollTop = outputElem.scrollHeight;
    }
}

export function updateStatusDisplay(ap, level, xp, xpNext, resources) {
    apValueDisplayElem.textContent = ap;
    levelValueDisplayElem.textContent = level;
    xpValueDisplayElem.textContent = xp;
    xpNextLevelValueDisplayElem.textContent = xpNext;
    const resStr = Object.entries(resources)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ') || 'None';
    resourcesDisplayElem.textContent = resStr;
}

export function populateMinerTypesInfo(minerTypesData, playerLevel) {
    minerTypesUlElem.innerHTML = '';
    Object.entries(minerTypesData).forEach(([name, data]) => {
        const li = document.createElement('li');
        let status = "";
        if (data.levelRequired > playerLevel) {
            status = ` (Locked - Requires Level ${data.levelRequired})`;
            li.style.color = "#777";
        }
        li.textContent = `${name} (Generates: ${data.resource}, Tier: ${data.tier})${status}`;
        minerTypesUlElem.appendChild(li);
    });
}

export function showMinerTypesInfo() {
    minerTypesInfoDivElem.classList.remove('hidden');
}

export function hideMinerTypesInfo() {
    minerTypesInfoDivElem.classList.add('hidden');
}

export function isMinerTypesInfoVisible() {
    return !minerTypesInfoDivElem.classList.contains('hidden');
}

export function updatePredictionsUIDisplay(predictions, selectedIndex, onPredictionClickCallback) {
    predictionsContainerElem.innerHTML = '';
    predictions.forEach((text, index) => {
        const item = document.createElement('div');
        item.textContent = text;
        item.classList.add('prediction-item');
        if (index === selectedIndex) {
            item.classList.add('selected');
        }
        item.addEventListener('click', () => onPredictionClickCallback(text));
        predictionsContainerElem.appendChild(item);
    });
}

export function clearPredictionsUI() {
    if (predictionsContainerElem) predictionsContainerElem.innerHTML = '';
}

export function getCommandInputValue() {
    return commandInputElem.value;
}

export function setCommandInputValue(value) {
    commandInputElem.value = value;
}

export function focusCommandInput() {
    commandInputElem.focus();
    // Ensure cursor is at the end
    setTimeout(() => commandInputElem.setSelectionRange(commandInputElem.value.length, commandInputElem.value.length), 0);
}

export function clearCommandInput() {
    commandInputElem.value = '';
}

export function disableCommandInput() {
    commandInputElem.disabled = true;
}

export function getCommandInputElement() {
    return commandInputElem;
}

export function clearOutput() {
    if (outputElem) {
        outputElem.innerHTML = '';
    }
}