# Nonogram Solver

A web-based Nonogram (Picross) puzzle generator and automated solver. This project allows users to generate random puzzles, create custom puzzles, play them manually, or watch an algorithm visually solve them using logical deduction and backtracking.

## Features

- **Puzzle Generation:** Generate random Nonogram puzzles of varying sizes (guaranteed to avoid completely empty '0' clue rows or columns).
- **Manual Play:** Play the generated puzzles manually. Left-click to fill, right-click to mark as empty, and click-and-drag across cells to draw continuously. Track your time!
- **Automated Solver:** Watch the algorithm solve the puzzle step-by-step. The solver uses logical deduction (finding overlaps among all valid line permutations) and backtracking for complex configurations.
- **Custom Puzzles:** Set up an empty grid and input your own row and column clues by directly editing them on the grid.
- **Visualization Controls:** Adjust the solving speed or pause/resume the solver at any time.
- **Persistent Settings:** Your preferred puzzle size and solving speed are automatically saved using Local Storage.

## Project Structure

- `style.css`: Contains the UI styling, grid layout (including thick borders for 5x5 block groupings), empty cell cross markers, and CSS animations.
- `main.js`: Handles UI interactions, timer, grid rendering, and DOM manipulation. Contains an integrated `NonogramSolver` implementation and `PuzzleGenerator`.
- `generator.js`: Contains the standalone logic for generating valid random Nonogram grids and deriving their clues.
- `solver.js`: Contains a standalone, modular `NonogramSolver` class implementation representing the core logical line-solving engine.

## How to Run

Simply open the HTML file (e.g., `index.html`) in any modern web browser to start using the Nonogram Solver. No installation or build steps are necessary.

## How the Algorithm Works

1. **Line Solving (Logical Deduction):** For every row and column, the algorithm calculates all valid permutations of the blocks using a Stars and Bars distribution method. It then compares all valid permutations; if a cell is filled (or empty) in *every* valid permutation, its state is safely determined.
2. **Backtracking:** If logical deduction can no longer progress and the puzzle is not yet solved, the algorithm makes a guess on an unknown cell, saves the state, and continues. If it reaches an invalid state, it backtracks and tries the alternative.

## Usage

- **Generate:** Select a size and click "Generate" to create a new playable puzzle.
- **Custom:** Click "Custom" to set up an empty grid, edit the clues directly by clicking on them, then click "Solve".
- **Solve:** Click "Solve" to let the automated solver take over with visual updates.
- **Speed Slider:** Adjust the speed of the visualization dynamically.
- **Pause/Resume:** Pause the solver's execution at any time to inspect the board.
- **Clear:** Resets the board to an empty state for the current puzzle.