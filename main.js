class PuzzleGenerator {
    /**
     * Generates a random valid Nonogram puzzle 
     */
    static generate(size) {
        // Generate random grid (~60% probability of being filled to prevent extreme permutations on 25x25)
        const solution = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => Math.random() > 0.4 ? 1 : -1)
        );

        // Ensure no row or column is completely empty to prevent '0' clues
        for (let r = 0; r < size; r++) {
            if (!solution[r].includes(1)) solution[r][Math.floor(Math.random() * size)] = 1;
        }
        for (let c = 0; c < size; c++) {
            if (!solution.some(row => row[c] === 1)) solution[Math.floor(Math.random() * size)][c] = 1;
        }

        const rowClues = solution.map(row => PuzzleGenerator.getClues(row));
        const colClues = [];
        for (let c = 0; c < size; c++) {
            const col = solution.map(row => row[c]);
            colClues.push(PuzzleGenerator.getClues(col));
        }

        return { solution, rowClues, colClues };
    }

    static getClues(line) {
        const clues = [];
        let current = 0;
        for (let val of line) {
            if (val === 1) {
                current++;
            } else if (current > 0) {
                clues.push(current);
                current = 0;
            }
        }
        if (current > 0) clues.push(current);
        return clues.length > 0 ? clues : [0];
    }
}

class NonogramSolver {
    constructor(size, rowClues, colClues, updateCallback) {
        this.size = size;
        this.rowClues = rowClues;
        this.colClues = colClues;
        // 0 = unknown, 1 = filled, -1 = empty/discarded
        this.grid = Array(size).fill(null).map(() => Array(size).fill(0));
        this.updateCallback = updateCallback; 
        this.delay = 30; // ms between thought process steps
        this.isRunning = false;
        this.isPaused = false;
    }

    async sleep() {
        let waited = 0;
        while (waited < this.delay && this.isRunning) {
            if (!this.isPaused) {
                await new Promise(resolve => setTimeout(resolve, 10));
                waited += 10;
            } else {
                await new Promise(resolve => setTimeout(resolve, 50)); // Idle while paused
            }
        }
    }

    async solve() {
        this.isRunning = true;
        return await this.backtrack();
    }

    async backtrack() {
        if (!this.isRunning) return false;

        // 1. Run logical deduction as far as possible
        const isValid = await this.logicalSolve();
        if (!isValid) return false; // Guess was logically wrong
        if (this.isSolved()) return true; // Puzzle complete!

        // 2. Find the first unknown cell to guess
        let guessR = -1, guessC = -1;
        outer: for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c] === 0) {
                    guessR = r; guessC = c;
                    break outer;
                }
            }
        }

        if (guessR === -1) return this.isSolved();

        // 3. Save board state before making a guess
        const snapshot = this.grid.map(row => [...row]);

        // 4. Guess Filled (1)
        this.grid[guessR][guessC] = 1;
        await this.updateCallback(this.grid, { type: 'row', index: guessR, state: 'testing' });
        await this.sleep();
        if (await this.backtrack()) return true; // If this branch works, keep it!

        // 5. Revert and Guess Empty (-1)
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) this.grid[r][c] = snapshot[r][c];
        }
        if (!this.isRunning) return false;

        this.grid[guessR][guessC] = -1;
        await this.updateCallback(this.grid, { type: 'row', index: guessR, state: 'testing' });
        await this.sleep();
        if (await this.backtrack()) return true;

        // 6. Both guesses failed, revert state completely and return false up the chain
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) this.grid[r][c] = snapshot[r][c];
        }
        await this.updateCallback(this.grid);
        return false;
    }

    async logicalSolve() {
        let changed = true;
        while (changed && this.isRunning) {
            changed = false;
            for (let r = 0; r < this.size; r++) {
                if (!this.isRunning) return false;
                let result = await this.solveLine(this.grid[r], this.rowClues[r], 'row', r);
                if (result === -1) return false; // Invalid configuration
                if (result === 1) changed = true;
            }
            for (let c = 0; c < this.size; c++) {
                if (!this.isRunning) return false;
                const colData = this.grid.map(row => row[c]);
                let result = await this.solveLine(colData, this.colClues[c], 'col', c);
                if (result === -1) return false; // Invalid configuration
                if (result === 1) {
                    changed = true;
                    for (let r = 0; r < this.size; r++) this.grid[r][c] = colData[r];
                }
            }
        }
        return true; // Still a valid configuration
    }

    async solveLine(line, clues, type, index) {
        // Highlight the current line being tested visually
        await this.updateCallback(this.grid, { type, index, state: 'testing' });
        await this.sleep();

        const validPerms = this.getLinePermutations(clues, this.size, line);
        if (validPerms.length === 0) return -1; // Invalid configuration!

        let lineChanged = false;
        for (let i = 0; i < this.size; i++) {
            if (line[i] !== 0) continue; // Cell state is already known
            
            // Find commonalities across all valid permutations
            let allFilled = validPerms.every(p => p[i] === 1);
            let allEmpty = validPerms.every(p => p[i] === -1);
            
            if (allFilled) {
                line[i] = 1;
                lineChanged = true;
            } else if (allEmpty) {
                line[i] = -1;
                lineChanged = true;
            }
        }

        if (lineChanged) {
            await this.updateCallback(this.grid, { type, index, state: 'changed' });
            await this.sleep();
        }
        return lineChanged ? 1 : 0;
    }

    // Generates all valid permutations for a line using Stars and Bars distribution
    getLinePermutations(clues, length, currentLine) {
        if (clues.length === 1 && clues[0] === 0) {
            let p = Array(length).fill(-1);
            return this.isValidMatch(p, currentLine) ? [p] : [];
        }

        let perms = [];
        let numBlocks = clues.length;
        let minSpaces = numBlocks - 1;
        let blocksLen = clues.reduce((a, b) => a + b, 0);
        let slack = length - blocksLen - minSpaces;
        if (slack < 0) return [];

        const buildAndCheck = (spaces) => {
            let p = [];
            for (let i = 0; i < numBlocks; i++) {
                let numSpaces = spaces[i] + (i > 0 ? 1 : 0);
                for(let s=0; s<numSpaces; s++) p.push(-1);
                for(let b=0; b<clues[i]; b++) p.push(1);
            }
            for(let s=0; s<spaces[numBlocks]; s++) p.push(-1);
            
            if (this.isValidMatch(p, currentLine)) perms.push(p);
        };

        const distribute = (s, buckets, currentDist) => {
            if (buckets === 1) return buildAndCheck([...currentDist, s]);
            for (let i = 0; i <= s; i++) distribute(s - i, buckets - 1, [...currentDist, i]);
        };

        distribute(slack, numBlocks + 1, []);
        return perms;
    }

    isValidMatch(perm, currentLine) {
        for (let i = 0; i < perm.length; i++) {
            if (currentLine[i] !== 0 && currentLine[i] !== perm[i]) return false;
        }
        return true;
    }

    isSolved() {
        return this.grid.every(row => row.every(cell => cell !== 0));
    }
    
    stop() {
        this.isRunning = false;
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }
}

let currentSize = parseInt(localStorage.getItem('nonogram-size')) || 10;
let puzzleData = null;
let solverInstance = null;

let table, sizeSelect, btnGenerate, btnCustom, btnClear, btnSolve, btnPause, statusDiv, speedSlider, speedValue, timerDiv;
let timerInterval = null;
let secondsElapsed = 0;
let isDragging = false;
let dragTargetState = null;

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function resetTimer() {
    stopTimer();
    secondsElapsed = 0;
    timerDiv.innerText = formatTime(secondsElapsed);
}

function startTimer() {
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            secondsElapsed++;
            timerDiv.innerText = formatTime(secondsElapsed);
        }, 1000);
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Ensure the HTML DOM is fully loaded before querying elements
function setup() {
    table = document.getElementById('nonogram-table');
    sizeSelect = document.getElementById('size-select');
    btnGenerate = document.getElementById('btn-generate');
    btnCustom = document.getElementById('btn-custom');
    btnClear = document.getElementById('btn-clear');
    btnSolve = document.getElementById('btn-solve');
    btnPause = document.getElementById('btn-pause');
    statusDiv = document.getElementById('status');
    speedSlider = document.getElementById('speed-slider');
    speedValue = document.getElementById('speed-value');
    timerDiv = document.getElementById('timer');
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
} else {
    setup();
}

function init() {
    try {
        const savedSpeed = localStorage.getItem('nonogram-speed') || '80';
        speedSlider.value = savedSpeed;
        speedValue.textContent = savedSpeed;
        sizeSelect.value = currentSize;

        btnGenerate.addEventListener('click', generateNewPuzzle);
        btnCustom.addEventListener('click', createCustomPuzzle);
        btnClear.addEventListener('click', clearBoard);
        btnSolve.addEventListener('click', startSolver);
        btnPause.addEventListener('click', togglePauseAnimation);
        sizeSelect.addEventListener('change', (e) => {
            currentSize = parseInt(e.target.value);
            localStorage.setItem('nonogram-size', currentSize);
            generateNewPuzzle();
        });
        speedSlider.addEventListener('input', (e) => {
            speedValue.textContent = e.target.value;
            localStorage.setItem('nonogram-speed', e.target.value);
            if (solverInstance) {
                const val = parseInt(e.target.value);
                solverInstance.delay = Math.pow(100 - val, 2) / 10;
            }
        });
        generateNewPuzzle();
    } catch (err) {
        statusDiv.innerText = "Error initializing: " + err.message;
        console.error(err);
    }
}

function togglePauseAnimation() {
    if (solverInstance && solverInstance.isRunning) {
        const isPaused = solverInstance.togglePause();
        btnPause.innerText = isPaused ? "Resume" : "Pause";
        if (isPaused) {
            statusDiv.innerText = "Animation Paused.";
        } else {
            statusDiv.innerText = "Solving... Visualizing logical overlaps.";
        }
    }
}

function generateNewPuzzle() {
    try {
        if (solverInstance) solverInstance.stop();
        puzzleData = PuzzleGenerator.generate(currentSize);
        currentGrid = Array(currentSize).fill(null).map(() => Array(currentSize).fill(0)); // Reset grid state!
        renderEmptyBoard(currentSize, puzzleData.rowClues, puzzleData.colClues);
        statusDiv.innerText = "New puzzle generated. Ready to solve.";
        btnPause.disabled = true;
        btnPause.innerText = "Pause";
        resetTimer();
    } catch (err) {
        statusDiv.innerText = "Error generating puzzle: " + err.message;
        console.error(err);
    }
}

function createCustomPuzzle() {
    try {
        if (solverInstance) solverInstance.stop();
        const emptyClues = Array(currentSize).fill([0]);
        puzzleData = {
            solution: null, // Null indicates there is no known solution
            rowClues: JSON.parse(JSON.stringify(emptyClues)),
            colClues: JSON.parse(JSON.stringify(emptyClues))
        };
        currentGrid = Array(currentSize).fill(null).map(() => Array(currentSize).fill(0));
        renderEmptyBoard(currentSize, puzzleData.rowClues, puzzleData.colClues);
        statusDiv.innerText = "Custom puzzle created. Click clues to edit them, then click Solve.";
        btnPause.disabled = true;
        btnPause.innerText = "Pause";
        resetTimer();
    } catch (err) {
        statusDiv.innerText = "Error creating custom puzzle: " + err.message;
        console.error(err);
    }
}

function updateCustomClues() {
    if (!puzzleData || puzzleData.solution !== null) return;
    for (let c = 0; c < currentSize; c++) {
        const th = document.getElementById(`clue-col-${c}`);
        if (th) {
            const nums = th.innerText.trim().split(/[\s\n]+/).map(n => parseInt(n)).filter(n => !isNaN(n));
            puzzleData.colClues[c] = nums.length > 0 ? nums : [0];
        }
    }
    for (let r = 0; r < currentSize; r++) {
        const th = document.getElementById(`clue-row-${r}`);
        if (th) {
            const nums = th.innerText.trim().split(/[\s\n]+/).map(n => parseInt(n)).filter(n => !isNaN(n));
            puzzleData.rowClues[r] = nums.length > 0 ? nums : [0];
        }
    }
}

function clearBoard() {
    try {
        if (solverInstance) solverInstance.stop();
        currentGrid = Array(currentSize).fill(null).map(() => Array(currentSize).fill(0));
        updateUI(currentGrid);
        statusDiv.innerText = "Board cleared. Ready to solve.";
        btnPause.disabled = true;
        btnPause.innerText = "Pause";
        resetTimer();
    } catch (err) {
        statusDiv.innerText = "Error clearing board: " + err.message;
        console.error(err);
    }
}

function renderEmptyBoard(size, rowClues, colClues) {
    table.innerHTML = '';

    // Create Top Row for Column Clues
    const trTop = document.createElement('tr');
    trTop.appendChild(document.createElement('th')); // Top-left empty space
    colClues.forEach((clue, c) => {
        const th = document.createElement('th');
        th.id = `clue-col-${c}`;
        th.innerHTML = clue.join('<br>');
        th.className = 'clue-col';
        if (puzzleData && puzzleData.solution === null) {
            th.contentEditable = "true";
            th.addEventListener('input', updateCustomClues);
            th.addEventListener('focus', function() {
                const range = document.createRange();
                range.selectNodeContents(this);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            });
        }
        trTop.appendChild(th);
    });
    table.appendChild(trTop);

    // Create Row Clues and Grid Cells
    for (let r = 0; r < size; r++) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.id = `clue-row-${r}`;
        th.innerHTML = rowClues[r].join(' ');
        th.className = 'clue-row';
        if (puzzleData && puzzleData.solution === null) {
            th.contentEditable = "true";
            th.addEventListener('input', updateCustomClues);
            th.addEventListener('focus', function() {
                const range = document.createRange();
                range.selectNodeContents(this);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            });
        }
        tr.appendChild(th);

        for (let c = 0; c < size; c++) {
            const td = document.createElement('td');
            td.id = `cell-${r}-${c}`;
            td.className = 'cell';
            if (c === 0) td.classList.add('thick-left');
            if (r === 0) td.classList.add('thick-top');
            if ((c + 1) % 5 === 0 || c === size - 1) td.classList.add('thick-right');
            if ((r + 1) % 5 === 0 || r === size - 1) td.classList.add('thick-bottom');
            
            // Add mouse listeners for manual dragging
            td.addEventListener('mousedown', (e) => {
                if (solverInstance && solverInstance.isRunning) return;
                startTimer();
                isDragging = true;
                
                const currentState = currentGrid[r][c];
                if (e.button === 0) { // Left click
                    dragTargetState = currentState === 0 ? 1 : (currentState === 1 ? -1 : 0);
                } else if (e.button === 2) { // Right click
                    dragTargetState = currentState === 0 ? -1 : (currentState === -1 ? 1 : 0);
                } else {
                    return;
                }
                
                currentGrid[r][c] = dragTargetState;
                updateUI(currentGrid);
                if (checkWinCondition()) {
                    stopTimer();
                    statusDiv.innerText = `Congratulations! You solved the puzzle manually in ${formatTime(secondsElapsed)}!`;
                    fillEmptyWithCrosses();
                }
            });
            
            td.addEventListener('mouseenter', () => {
                if (isDragging && (!solverInstance || !solverInstance.isRunning)) {
                    currentGrid[r][c] = dragTargetState;
                    updateUI(currentGrid);
                    if (checkWinCondition()) {
                        stopTimer();
                        statusDiv.innerText = `Congratulations! You solved the puzzle manually in ${formatTime(secondsElapsed)}!`;
                        fillEmptyWithCrosses();
                    }
                }
            });

            td.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // Prevent browser right-click menu
            });

            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
}

function checkWinCondition() {
    if (!puzzleData || !currentGrid) return false;
    for (let r = 0; r < currentSize; r++) {
        for (let c = 0; c < currentSize; c++) {
            const isFilledInSolution = puzzleData.solution[r][c] === 1;
            const isFilledInGrid = currentGrid[r][c] === 1;
            if (isFilledInSolution !== isFilledInGrid) return false;
        }
    }
    return true;
}

function fillEmptyWithCrosses() {
    for (let r = 0; r < currentSize; r++) {
        for (let c = 0; c < currentSize; c++) {
            if (currentGrid[r][c] === 0) {
                currentGrid[r][c] = -1;
            }
        }
    }
    updateUI(currentGrid);
}

async function updateUI(gridState, highlightInfo) {
    // Clear previous highlights
    document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('highlight'));
    
    for (let r = 0; r < currentSize; r++) {
        for (let c = 0; c < currentSize; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            const val = gridState[r][c];
            
            cell.classList.remove('filled', 'empty');
            if (val === 1) cell.classList.add('filled');
            if (val === -1) cell.classList.add('empty');

            // Add visualization highlights
            if (highlightInfo) {
                if (highlightInfo.type === 'row' && r === highlightInfo.index) cell.classList.add('highlight');
                if (highlightInfo.type === 'col' && c === highlightInfo.index) cell.classList.add('highlight');
            }
        }
    }

    if (puzzleData && puzzleData.solution) {
        for (let r = 0; r < currentSize; r++) {
            let rowComplete = true;
            for (let c = 0; c < currentSize; c++) {
                if ((puzzleData.solution[r][c] === 1) !== (gridState[r][c] === 1)) {
                    rowComplete = false; break;
                }
            }
            const thRow = document.getElementById(`clue-row-${r}`);
            if (thRow) {
                if (rowComplete) thRow.classList.add('clue-completed');
                else thRow.classList.remove('clue-completed');
            }
        }
        for (let c = 0; c < currentSize; c++) {
            let colComplete = true;
            for (let r = 0; r < currentSize; r++) {
                if ((puzzleData.solution[r][c] === 1) !== (gridState[r][c] === 1)) {
                    colComplete = false; break;
                }
            }
            const thCol = document.getElementById(`clue-col-${c}`);
            if (thCol) {
                if (colComplete) thCol.classList.add('clue-completed');
                else thCol.classList.remove('clue-completed');
            }
        }
    }
}

async function startSolver() {
    try {
        stopTimer();
        if (solverInstance) solverInstance.stop();
        btnPause.disabled = false;
        btnPause.innerText = "Pause";
        statusDiv.innerText = "Solving... Visualizing logical overlaps.";
        
        solverInstance = new NonogramSolver(currentSize, puzzleData.rowClues, puzzleData.colClues, updateUI, currentGrid);
        solverInstance.delay = Math.pow(100 - parseInt(speedSlider.value), 2) / 10;
        const fullySolved = await solverInstance.solve();
        
        currentGrid = solverInstance.grid.map(row => [...row]); // Sync grid so you can continue playing if it halts

        document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('highlight'));
        statusDiv.innerText = fullySolved ? "Puzzle Solved Successfully!" : "Algorithm Halted.";
        btnPause.disabled = true;
    } catch (err) {
        statusDiv.innerText = "Error during solve: " + err.message;
        console.error(err);
    }
}