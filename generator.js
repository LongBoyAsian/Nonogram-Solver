export class PuzzleGenerator {
    /**
     * Generates a random valid Nonogram puzzle 
     */
    static generate(size) {
        // Generate random grid (~60% probability of being filled to prevent extreme permutations on 25x25)
        const solution = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => Math.random() > 0.4 ? 1 : -1)
        );

        const rowClues = solution.map(row => this.getClues(row));
        const colClues = [];
        for (let c = 0; c < size; c++) {
            const col = solution.map(row => row[c]);
            colClues.push(this.getClues(col));
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