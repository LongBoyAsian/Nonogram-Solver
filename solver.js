export class NonogramSolver {
    constructor(size, rowClues, colClues, updateCallback) {
        this.size = size;
        this.rowClues = rowClues;
        this.colClues = colClues;
        // 0 = unknown, 1 = filled, -1 = empty/discarded
        this.grid = Array(size).fill(null).map(() => Array(size).fill(0));
        this.updateCallback = updateCallback; 
        this.delay = 30; // ms between thought process steps
        this.isRunning = false;
    }

    async sleep() {
        return new Promise(resolve => setTimeout(resolve, this.delay));
    }

    async solve() {
        this.isRunning = true;
        let changed = true;
        
        // The algorithm repeatedly checks rows then columns for valid line intersections
        while (changed && this.isRunning) {
            changed = false;
            
            // Check all rows
            for (let r = 0; r < this.size; r++) {
                if (!this.isRunning) return;
                let solved = await this.solveLine(this.grid[r], this.rowClues[r], 'row', r);
                if (solved) changed = true;
            }
            
            // Check all columns
            for (let c = 0; c < this.size; c++) {
                if (!this.isRunning) return;
                const colData = this.grid.map(row => row[c]);
                let solved = await this.solveLine(colData, this.colClues[c], 'col', c);
                if (solved) {
                    changed = true;
                    for (let r = 0; r < this.size; r++) this.grid[r][c] = colData[r];
                }
            }
        }
        
        return this.isSolved();
    }

    async solveLine(line, clues, type, index) {
        // Highlight the current line being tested visually
        await this.updateCallback(this.grid, { type, index, state: 'testing' });
        await this.sleep();

        const validPerms = this.getLinePermutations(clues, this.size, line);
        if (validPerms.length === 0) return false; // Should not happen in valid puzzles

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
        return lineChanged;
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
}