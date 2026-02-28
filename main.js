const display = document.getElementById('display');

function appendValue(value) {
    display.value += value;
}

function appendOperator(operator) {
    const current = display.value;
    if (current && !isOperator(current[current.length - 1])) {
        display.value += operator;
    }
}

function appendFunction(func) {
    display.value += func;
}

function isOperator(char) {
    return ['+', '-', '*', '/', '^'].includes(char);
}

function clearDisplay() {
    display.value = '';
}

function calculate() {
    try {
        let expression = display.value;
        
        // Replace trigonometric functions
        expression = expression.replace(/sin\(/g, 'Math.sin(');
        expression = expression.replace(/cos\(/g, 'Math.cos(');
        expression = expression.replace(/tan\(/g, 'Math.tan(');
        
        // Convert degrees to radians for trigonometric functions
        expression = expression.replace(/Math\.(sin|cos|tan)\(([^)]+)\)/g, (match, func, angle) => {
            const radian = parseFloat(angle) * (Math.PI / 180);
            return `Math.${func}(${radian})`;
        });
        
        // Replace square root
        expression = expression.replace(/√/g, 'Math.sqrt');
        
        // Replace exponentiation
        expression = expression.replace(/\^/g, '**');
        
        // Evaluate the expression
        const result = eval(expression);
        
        // Round to 10 decimal places to avoid floating point errors
        display.value = Math.round(result * 10000000000) / 10000000000;
    } catch (error) {
        display.value = 'Error';
        console.error('Calculation error:', error);
    }
}

// Allow Enter key to calculate
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        calculate();
    }
});

// Allow Backspace to delete
document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
        display.value = display.value.slice(0, -1);
    }
});
