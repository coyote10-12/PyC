function tokenize(code) {
    const tokens = code.match(/'[^']*'|[A-Za-z_]\w*|\d+|\^|==|!=|<=|>=|&|[(){};=+\-*/]/g);
    return tokens || [];
}

/* Wait for input inside the fake console */
function waitForInput() {
    return new Promise(resolve => {
        const input = document.getElementById("consoleInput");

        input.value = "";
        input.focus();

        function handler(e) {
            if (e.key === "Enter") {
                input.removeEventListener("keydown", handler);
                resolve(input.value);
            }
        }

        input.addEventListener("keydown", handler);
    });
}

/* ------------------ MATH PARSER (PEMDAS + EXPONENTS) ------------------ */

function parseMath(tokens) {
    let i = 0;

    function peek() { return tokens[i]; }
    function consume(t) {
        if (t && tokens[i] !== t) throw "SyntaxError: expected " + t;
        return tokens[i++];
    }

    // Primary: numbers, variables, parentheses
    function primary() {
        let t = peek();

        // Parentheses
        if (t === "(") {
            consume("(");
            let expr = expression();
            consume(")");
            return expr;
        }

        // Negative numbers or negative parentheses
        if (t === "-") {
            consume("-");
            return -primary();
        }

        // Number literal
        if (/^\d+$/.test(t)) {
            consume();
            return Number(t);
        }

        // Variable
        if (/^[A-Za-z_]\w*$/.test(t)) {
            consume();
            return { var: t };
        }

        throw "SyntaxError: invalid math token " + t;
    }

    // Exponentiation (right-associative)
    function exponent() {
        let left = primary();
        while (peek() === "^") {
            consume("^");
            let right = exponent(); // right-associative
            left = { op: "^", left, right };
        }
        return left;
    }

    // Multiplication / Division
    function term() {
        let left = exponent();
        while (peek() === "*" || peek() === "/") {
            let op = consume();
            let right = exponent();
            left = { op, left, right };
        }
        return left;
    }

    // Addition / Subtraction
    function expression() {
        let left = term();
        while (peek() === "+" || peek() === "-") {
            let op = consume();
            let right = term();
            left = { op, left, right };
        }
        return left;
    }

    let result = expression();
    if (i !== tokens.length) throw "SyntaxError: extra tokens in math";
    return result;
}

function evalMath(node, vars) {
    if (typeof node === "number") return node;

    if (node.var) {
        if (!(node.var in vars)) throw "ReferenceError: " + node.var + " not defined";
        let v = vars[node.var];
        if (typeof v !== "number") throw "TypeError: variable " + node.var + " is not numeric";
        return v;
    }

    let a = evalMath(node.left, vars);
    let b = evalMath(node.right, vars);

    switch (node.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "^": return Math.pow(a, b);
    }

    throw "SyntaxError: invalid math operation";
}

/* ------------------ EXECUTION ENGINE ------------------ */

async function execute(commands, vars = {}) {
    const output = document.getElementById("output");

    function print(text) {
        output.innerHTML += text + "<br>";
        output.scrollTop = output.scrollHeight;
    }

    for (let cmd of commands) {
        const op = cmd[0];

        /* say('a' & b & str(10+5)) */
        if (op === "say_concat") {
            let parts = cmd[1];
            let out = "";

            for (let p of parts) {

                // str(...) literalizer
                if (p.startsWith("str(") && p.endsWith(")")) {
                    out += p.slice(4, -1); // literal inside str()
                    continue;
                }

                // string literal
                if (p[0] === "'" && p[p.length - 1] === "'") {
                    out += p.substring(1, p.length - 1);
                    continue;
                }

                // math expression inside say()
                if (/[\d()+\-*/^]/.test(p)) {
                    let mtokens = tokenize(p);
                    let tree = parseMath(mtokens);
                    out += evalMath(tree, vars);
                    continue;
                }

                // variable
                if (p in vars) {
                    out += vars[p];
                    continue;
                }

                throw "Unknown value: " + p;
            }

            print(out);
        }

        /* var(name) */
        else if (op === "var_decl") {
            vars[cmd[1]] = null;
        }

        /* var(name) = value */
        else if (op === "var_set") {
            const name = cmd[1];
            const value = cmd[2];

            // string literal
            if (value[0] === "'" && value[value.length - 1] === "'") {
                vars[name] = value.substring(1, value.length - 1);
                continue;
            }

            // math expression
            if (/[\d()+\-*/^]/.test(value)) {
                let mtokens = tokenize(value);
                let tree = parseMath(mtokens);
                vars[name] = evalMath(tree, vars);
                continue;
            }

            // variable assignment
            if (value in vars) {
                vars[name] = vars[value];
                continue;
            }

            throw "SyntaxError: invalid assignment value " + value;
        }

        /* ret(name) */
        else if (op === "input") {
            const name = cmd[1];
            vars[name] = await waitForInput();
        }
    }

    return vars;
}

/* ------------------ PARSER ------------------ */

function parse(tokens) {
    const commands = [];
    let i = 0;

    while (i < tokens.length) {
        const tok = tokens[i];

        if (tok === ";") { i++; continue; }

        /* say(...) */
        if (tok === "say") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected (";

            let j = i + 2;
            let parts = [];

            while (tokens[j] !== ")") {
                if (tokens[j] === "&") { j++; continue; }
                parts.push(tokens[j]);
                j++;
                if (j >= tokens.length) throw "SyntaxError: missing )";
            }

            commands.push(["say_concat", parts]);
            i = j + 1;
            continue;
        }

        /* var(name) or var(name) = value */
        if (tok === "var") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected (";
            const name = tokens[i+2];
            if (tokens[i+3] !== ")") throw "SyntaxError: expected )";

            if (tokens[i+4] === "=") {
                const value = tokens[i+5];
                commands.push(["var_set", name, value]);
                i += 6;
            } else {
                commands.push(["var_decl", name]);
                i += 4;
            }
            continue;
        }

        /* ret(name) */
        if (tok === "ret") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected (";
            const name = tokens[i+2];
            if (tokens[i+3] !== ")") throw "SyntaxError: expected )";
            commands.push(["input", name]);
            i += 4;
            continue;
        }

        throw "Unknown token: " + tok;
    }

    return commands;
}

/* ------------------ RUNNER ------------------ */

async function runPyC(code) {
    const tokens = tokenize(code);
    const commands = parse(tokens);
    return await execute(commands);
}

function runPyCFromEditor() {
    const output = document.getElementById("output");
    output.innerHTML = "";

    const code = document.getElementById("codeBox").value;

    runPyC(code).catch(err => {
        output.innerHTML += "<span style='color:red'>" + err + "</span>";
    });
}

document.getElementById("runBtn").addEventListener("click", () => {
    const output = document.getElementById("output");
    output.innerHTML = "";

    const code = document.getElementById("codeBox").value;

    runPyC(code).catch(err => {
        output.innerHTML += `<span style="color:red">${err}</span>`;
    });
});
