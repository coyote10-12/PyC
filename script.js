// script.js

// Functionality for history
let historyArray = [];

function addToHistory(value) {
    historyArray.push(value);
}

function getHistory() {
    return historyArray;
}

// Constants for PI and Euler's number
const PI = Math.PI;
const E = Math.E;

// Function to get known constants
function getConstants() {
    return {
        pi: PI,
        e: E
    };
}

// Exporting functionality if needed
module.exports = { addToHistory, getHistory, getConstants };