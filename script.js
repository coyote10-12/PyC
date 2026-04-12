/* ============================================================
        TOKENIZER
============================================================ */

function tokenize(code) {
    return code.match(/'[^']*'|==|!=|<=|>=|[A-Za-z_]\w*|\d+|[(){};=+\-*/<>]/g) || [];
}

/* ============================================================
        CONSOLE INPUT
============================================================ */

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

/* ============================================================
        MATH PARSER (PEMDAS)
============================================================ */

function parseMath(tokens) {
    let i = 0;

    function peek() { return tokens[i]; }
    function consume(t) {
        if (t && tokens[i] !== t) throw "SyntaxError: expected " + t;
        return tokens[i++];
    }

    function primary() {
        let t = peek();

        if (t === "(") {
            consume("(");
            let expr = expression();
            consume(")");
            return expr;
        }

        if (t === "-") {
            consume("-");
            return -primary();
        }

        if (/^\d+$/.test(t)) {
            consume();
            return Number(t);
        }

        if (/^[A-Za-z_]\w*$/.test(t)) {
            consume();
            return { var: t };
        }

        throw "SyntaxError: invalid math token " + t;
    }

    function exponent() {
        let left = primary();
        while (peek() === "^") {
            consume("^");
            let right = exponent();
            left = { op: "^", left, right };
        }
        return left;
    }

    function term() {
        let left = exponent();
        while (peek() === "*" || peek() === "/") {
            let op = consume();
            let right = exponent();
            left = { op, left, right };
        }
        return left;
    }

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

/* ============================================================
        CONDITION EVALUATOR
============================================================ */

function evalCondition(expr, vars) {
    const replaced = expr.replace(/\b[A-Za-z_]\w*\b/g, name => {
        if (name in vars) return JSON.stringify(vars[name]);
        return name;
    });

    return Function(`return (${replaced});`)();
}

/* ============================================================
        PARSER
============================================================ */

function parse(tokens) {
    const commands = [];
    let i = 0;

    while (i < tokens.length) {
        const tok = tokens[i];

        if (tok === ";") {
            i++;
            continue;
        }

        /* ---------------- IF ---------------- */
        if (tok === "if" && tokens[i+1] === "(") {
            let j = i + 2;
            let cond = "";

            while (tokens[j] !== ")") {
                if (j >= tokens.length) throw "SyntaxError: missing ) in if";
                cond += tokens[j];
                j++;
            }

            if (tokens[j+1] !== "{") throw "SyntaxError: expected { after if(...)";

            commands.push(["if_start", cond]);
            i = j + 2;
            continue;
        }

        /* ---------------- OR ---------------- */
        if (tok === "}" && tokens[i+1] === "or" && tokens[i+2] === "(") {
            let j = i + 3;
            let cond = "";

            while (tokens[j] !== ")") {
                if (j >= tokens.length) throw "SyntaxError: missing ) in or";
                cond += tokens[j];
                j++;
            }

            if (tokens[j+1] !== "{") throw "SyntaxError: expected { after } or (...)";

            commands.push(["or_start", cond]);
            i = j + 2;
            continue;
        }

        /* ---------------- ELSE ---------------- */
        if (tok === "}" && tokens[i+1] === "else" && tokens[i+2] === "{") {
            commands.push(["else_start"]);
            i += 3;
            continue;
        }

        /* ---------------- FOR ---------------- */
        if (tok === "for" && tokens[i+1] === "(") {
            let j = i + 2;

            /* ---- initializer ---- */
            let init = "";
            while (tokens[j] !== ";") {
                if (j >= tokens.length) throw "SyntaxError: missing ; in for initializer";
                init += tokens[j];
                j++;
            }
            j++; // skip ;

            /* ---- condition ---- */
            let cond = "";
            while (tokens[j] !== ";") {
                if (j >= tokens.length) throw "SyntaxError: missing ; in for condition";
                cond += tokens[j];
                j++;
            }
            j++; // skip ;

            /* ---- increment ---- */
            let inc = "";
            while (tokens[j] !== ")") {
                if (j >= tokens.length) throw "SyntaxError: missing ) in for increment";
                inc += tokens[j];
                j++;
            }

            if (tokens[j+1] !== "{") throw "SyntaxError: expected { after for(...)";

            commands.push(["for_start", init, cond, inc]);
            i = j + 2;
            continue;
        }

        /* ---------------- END BLOCK ---------------- */
        if (tok === "}") {
            commands.push(["end_block"]);
            i++;
            continue;
        }

        /* ---------------- SAY ---------------- */
        if (tok === "say") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected ( after say";

            let j = i + 2;
            let parts = [];

            while (tokens[j] !== ")") {
                if (tokens[j] === "&") {
                    j++;
                    continue;
                }
                parts.push(tokens[j]);
                j++;
                if (j >= tokens.length) throw "SyntaxError: missing ) in say(...)";
            }

            commands.push(["say_concat", parts]);
            i = j + 1;
            continue;
        }

        /* ---------------- VAR ---------------- */
        if (tok === "var") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected ( after var";
            const name = tokens[i+2];
            if (tokens[i+3] !== ")") throw "SyntaxError: expected ) after var(name)";

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

        /* ---------------- INPUT ---------------- */
        if (tok === "ret") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected ( after ret";
            const name = tokens[i+2];
            if (tokens[i+3] !== ")") throw "SyntaxError: expected ) after ret(name)";
            commands.push(["input", name]);
            i += 4;
            continue;
        }

        throw "Unknown token: " + tok;
    }

    return commands;
}

/* ============================================================
        FOR HELPERS
============================================================ */

function runForInit(text, vars) {
    // Allowed:
    // var(i)=0
    // i=0

    if (text.startsWith("var(")) {
        let name = text.slice(4, text.indexOf(")"));
        let value = text.split("=")[1];

        if (!/^\d+$/.test(value)) throw "For initializer must assign a number";
        vars[name] = Number(value);
        return;
    }

    // i=0
    if (text.includes("=")) {
        let [name, value] = text.split("=");

        if (!(name in vars)) throw "Variable " + name + " not declared";
        if (!/^\d+$/.test(value)) throw "For initializer must assign a number";

        vars[name] = Number(value);
        return;
    }

    throw "Invalid for initializer: " + text;
}

function runForInc(text, vars) {
    // Only +i or -i allowed
    if (text.startsWith("+")) {
        let name = text.slice(1);
        if (!(name in vars)) throw "Variable " + name + " not declared";
        if (typeof vars[name] !== "number") throw "Increment requires numeric variable";
        vars[name]++;
        return;
    }

    if (text.startsWith("-")) {
        let name = text.slice(1);
        if (!(name in vars)) throw "Variable " + name + " not declared";
        if (typeof vars[name] !== "number") throw "Decrement requires numeric variable";
        vars[name]--;
        return;
    }

    throw "Invalid for increment: " + text;
}

/* ============================================================
        EXECUTION ENGINE
============================================================ */

async function execute(commands, vars = {}) {
    const output = document.getElementById("output");

    function print(text) {
        output.innerHTML += text + "<br>";
        output.scrollTop = output.scrollHeight;
    }

    let blockStack = [];

    for (let cmd of commands) {
        const op = cmd[0];

        /* ---------------- IF ---------------- */
        if (op === "if_start") {
            const cond = cmd[1];
            const result = evalCondition(cond, vars);

            blockStack.push({
                type: "if",
                active: result,
                branchTaken: result
            });
            continue;
        }

        /* ---------------- OR ---------------- */
        if (op === "or_start") {
            const block = blockStack[blockStack.length - 1];
            const cond = cmd[1];
            const result = evalCondition(cond, vars);

            block.active = !block.branchTaken && result;
            if (result) block.branchTaken = true;

            continue;
        }

        /* ---------------- ELSE ---------------- */
        if (op === "else_start") {
            const block = blockStack[blockStack.length - 1];

            block.active = !block.branchTaken;
            block.branchTaken = true;

            continue;
        }

        /* ---------------- FOR ---------------- */
        if (op === "for_start") {
            const init = cmd[1];
            const cond = cmd[2];
            const inc = cmd[3];

            runForInit(init, vars);

            blockStack.push({
                type: "for",
                cond,
                inc,
                active: evalCondition(cond, vars)
            });
            continue;
        }

        /* ---------------- END BLOCK ---------------- */
        if (op === "end_block") {
            const block = blockStack.pop();

            if (block.type === "for") {
                runForInc(block.inc, vars);

                if (evalCondition(block.cond, vars)) {
                    blockStack.push(block);
                }
            }
            continue;
        }

        /* Skip inactive blocks */
        if (blockStack.some(b => !b.active)) continue;

        /* ---------------- SAY ---------------- */
        if (op === "say_concat") {
            let parts = cmd[1];
            let out = "";

            for (let p of parts) {
                if (p.startsWith("str(") && p.endsendsWith(")")) {
                    out += p.slice(4, -1);
                    continue;
                }

                if (p[0] === "'" && p[p.length - 1] === "'") {
                    out += p.substring(1, p.length - 1);
                    continue;
                }

                if (/[\d()+\-*/^]/.test(p)) {
                    let mtokens = tokenize(p);
                    let tree = parseMath(mtokens);
                    out += evalMath(tree, vars);
                    continue;
                }

                if (p in vars) {
                    out += vars[p];
                    continue;
                }

                throw "Unknown value: " + p;
            }

            print(out);
            continue;
        }

        /* ---------------- VAR DECL ---------------- */
        if (op === "var_decl") {
            vars[cmd[1]] = null;
            continue;
        }

        /* ---------------- VAR SET ---------------- */
        if (op === "var_set") {
            const name = cmd[1];
            const value = cmd[2];

            if (value[0] === "'" && value[value.length - 1] === "'") {
                vars[name] = value.substring(1, value.length - 1);
                continue;
            }

            if (/[\d()+\-*/^]/.test(value)) {
                let mtokens = tokenize(value);
                let tree = parseMath(mtokens);
                vars[name] = evalMath(tree, vars);
                continue;
            }

            if (value in vars) {
                vars[name] = vars[value];
                continue;
            }

            throw "SyntaxError: invalid assignment value " + value;
        }

        /* ---------------- INPUT ---------------- */
        if (op === "input") {
            const name = cmd[1];
            vars[name] = await waitForInput();
            continue;
        }
    }

    return vars;
}

/* ============================================================
        RUNNER
============================================================ */

async function runPyC(code) {
    const tokens = tokenize(code);
    const commands = parse(tokens);
    return await execute(commands);
}

document.getElementById("runBtn").addEventListener("click", () => {
    const output = document.getElementById("output");
    output.innerHTML = "";

    const code = document.getElementById("codeBox").value;

    runPyC(code).catch(err => {
        output.innerHTML += `<span style="color:red">${err}</span>`;
    });
});

/* ============================================================
        AUTO-BRACE (CodeHS-style)
============================================================ */

document.getElementById("codeBox").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        const textarea = this;
        const start = textarea.selectionStart;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(start);

        // If the line ends with "{", auto-insert:
        // {
        //     <cursor>
        // }
        if (before.endsWith("{")) {
            e.preventDefault();

            const insert = "\n\t\n}";

            textarea.value = before + insert + after;

            // Cursor goes on the indented blank line
            textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
    }
});
