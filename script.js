/* ============================================================
        TOKENIZER
============================================================ */

function tokenize(code) {
    return code.match(/'[^']*'|==|!=|<=|>=|[A-Za-z_]\w*|\d+|[(){};,=+\-*/<>]/g) || [];
}

/* ============================================================
        MATH PARSER
============================================================ */

function parseMath(tokens) {
    let i = 0;

    function parseExpression() {
        let node = parseTerm();
        while (tokens[i] === "+" || tokens[i] === "-") {
            let op = tokens[i++];
            let right = parseTerm();
            node = { op, left: node, right };
        }
        return node;
    }

    function parseTerm() {
        let node = parseFactor();
        while (tokens[i] === "*" || tokens[i] === "/") {
            let op = tokens[i++];
            let right = parseFactor();
            node = { op, left: node, right };
        }
        return node;
    }

    function parseFactor() {
        return parsePower();
    }

    function parsePower() {
        let node = parsePrimary();
        if (tokens[i] === "^") {
            i++;
            let right = parsePower();
            node = { op: "^", left: node, right };
        }
        return node;
    }

    function parsePrimary() {
        let t = tokens[i];

        if (/^\d+$/.test(t)) {
            i++;
            return { type: "num", value: Number(t) };
        }

        if (/^[A-Za-z_]\w*$/.test(t)) {
            i++;
            return { type: "var", name: t };
        }

        if (t === "(") {
            i++;
            let node = parseExpression();
            if (tokens[i] !== ")") throw "SyntaxError: missing )";
            i++;
            return node;
        }

        throw "SyntaxError: invalid math token " + t;
    }

    return parseExpression();
}

/* ============================================================
        MATH EVALUATOR
============================================================ */

function evalMath(node, vars) {
    if (node.type === "num") return node.value;

    if (node.type === "var") {
        if (!(node.name in vars)) throw "MathError: variable " + node.name + " not defined";
        if (typeof vars[node.name] !== "number") throw "MathError: " + node.name + " is not numeric";
        return vars[node.name];
    }

    let L = evalMath(node.left, vars);
    let R = evalMath(node.right, vars);

    switch (node.op) {
        case "+": return L + R;
        case "-": return L - R;
        case "*": return L * R;
        case "/": return L / R;
        case "^": return L ** R;
    }

    throw "MathError: unknown operator " + node.op;
}

/* ============================================================
        INPUT HANDLER
============================================================ */

function waitForInput() {
    return new Promise(resolve => {
        const inputBar = document.getElementById("inputBar");
        const inputBtn = document.getElementById("inputBtn");

        inputBar.style.display = "inline-block";
        inputBtn.style.display = "inline-block";
        inputBar.value = "";
        inputBar.focus();

        function finish() {
            const value = inputBar.value;
            inputBar.style.display = "none";
            inputBtn.style.display = "none";

            inputBtn.removeEventListener("click", finish);
            inputBar.removeEventListener("keydown", onKey);

            resolve(value);
        }

        function onKey(e) {
            if (e.key === "Enter") finish();
        }

        inputBtn.addEventListener("click", finish);
        inputBar.addEventListener("keydown", onKey);
    });
}

/* ============================================================
        PARSER (with functions)
============================================================ */

function parse(tokens) {
    let inFunction = false;
    const commands = [];
    let i = 0;
    const functions = {};

    function parseFunction() {
        inFunction = true;
        i++; // skip def

        const name = tokens[i++];
        if (!/^[A-Za-z_]\w*$/.test(name)) throw "SyntaxError: invalid function name";

        if (tokens[i++] !== "(") throw "SyntaxError: expected (";

        let params = [];
        while (tokens[i] !== ")") {
            if (!/^[A-Za-z_]\w*$/.test(tokens[i])) throw "SyntaxError: invalid parameter";
            params.push(tokens[i++]);

            if (tokens[i] === ",") i++;
        }
        i++; // skip )

        if (tokens[i++] !== "{") throw "SyntaxError: expected {";

        let body = [];
        let depth = 1;

        while (i < tokens.length && depth > 0) {
            if (tokens[i] === "{") depth++;
            if (tokens[i] === "}") depth--;

            if (depth > 0) body.push(tokens[i]);
            i++;
        }

        functions[name] = { params, body };
        inFunction = false;
    }

    function parseFunctionCall(name) {
        i++; // skip name
        i++; // skip (

        let args = [];
        let current = "";

        while (tokens[i] !== ")") {
            if (tokens[i] === ",") {
                args.push(current.trim());
                current = "";
                i++;
                continue;
            }
            current += tokens[i++];
        }

        if (current.trim() !== "") args.push(current.trim());
        i++; // skip )

        commands.push(["call", name, args]);
    }

    while (i < tokens.length) {
        const tok = tokens[i];

        /* FUNCTION DEF */
        if (tok === "def") {
            parseFunction();
            continue;
        }

        /* FUNCTION CALL (user-defined only) */
        if (
            /^[A-Za-z_]\w*$/.test(tok) &&
            tokens[i+1] === "(" &&
            !["if","for","var","say","ret","def","or","else"].includes(tok)
        ) {
            parseFunctionCall(tok);
            continue;
        }

        /* SEMICOLON */
        if (tok === ";") { i++; continue; }

        /* IF */
        if (tok === "if" && tokens[i+1] === "(") {
            let j = i + 2;
            let cond = "";
            while (tokens[j] !== ")") cond += tokens[j++];
            if (tokens[j+1] !== "{") throw "SyntaxError: expected {";
            commands.push(["if_start", cond]);
            i = j + 2;
            continue;
        }

        /* OR */
        if (tok === "}" && tokens[i+1] === "or" && tokens[i+2] === "(") {
            let j = i + 3;
            let cond = "";
            while (tokens[j] !== ")") cond += tokens[j++];
            if (tokens[j+1] !== "{") throw "SyntaxError: expected {";
            commands.push(["or_start", cond]);
            i = j + 2;
            continue;
        }

        /* ELSE */
        if (tok === "}" && tokens[i+1] === "else" && tokens[i+2] === "{") {
            commands.push(["else_start"]);
            i += 3;
            continue;
        }

        /* FOR */
        if (tok === "for" && tokens[i+1] === "(") {
            let j = i + 2;

            let init = "";
            while (tokens[j] !== ";") init += tokens[j++];
            j++;

            let cond = "";
            while (tokens[j] !== ";") cond += tokens[j++];
            j++;

            let inc = "";
            while (tokens[j] !== ")") inc += tokens[j++];

            if (tokens[j+1] !== "{") throw "SyntaxError: expected {";

            commands.push(["for_start", init, cond, inc]);
            i = j + 2;
            continue;
        }

        /* END BLOCK */
        if (tok === "}" && !inFunction) {
            commands.push(["end_block"]);
            i++;
            continue;
        }


        /* SAY */
        if (tok === "say") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected (";
            let j = i + 2;
            let parts = [];
            let current = "";

            while (tokens[j] !== ")") {
                if (tokens[j] === "&") {
                    if (current.trim() !== "") parts.push(current.trim());
                    current = "";
                    j++;
                    continue;
                }
                current += tokens[j++];
            }

            if (current.trim() !== "") parts.push(current.trim());
            commands.push(["say_concat", parts]);
            i = j + 1;
            continue;
        }

        /* VAR */
        if (tok === "var") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected (";
            const name = tokens[i+2];
            if (tokens[i+3] !== ")") throw "SyntaxError: expected )";

            if (tokens[i+4] === "=") {
                commands.push(["var_set", name, tokens[i+5]]);
                i += 6;
            } else {
                commands.push(["var_decl", name]);
                i += 4;
            }
            continue;
        }

        /* INPUT */
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

    commands.push(["functions", functions]);
    return commands;
}

/* ============================================================
        EXECUTION ENGINE
============================================================ */

async function execute(commands, globalVars = {}) {
    const output = document.getElementById("output");

    function print(text) {
        output.innerHTML += text + "<br>";
        output.scrollTop = output.scrollHeight;
    }

    let funcTable = {};
    for (let cmd of commands) {
        if (cmd[0] === "functions") funcTable = cmd[1];
    }

    let callStack = [];

    callStack.push({
        vars: globalVars,
        commands: commands,
        ip: 0
    });

    function evalValue(token, vars) {
        if (token.length >= 2 && token[0] === "'" && token[token.length - 1] === "'") {
            return token.substring(1, token.length - 1);
        }

        if (/[\d()+\-*/^]/.test(token)) {
            let mtokens = tokenize(token);
            let tree = parseMath(mtokens);
            return evalMath(tree, vars);
        }

        if (token in vars) return vars[token];

        throw "Unknown value: " + token;
    }

    /* ============================================================
            CONDITION EVALUATOR (correct location)
    ============================================================ */

    function evalCondition(text, vars) {
        let tokens = tokenize(text);

        let left = "";
        let op = "";
        let right = "";

        let i = 0;
        while (i < tokens.length && !["==","!=",">","<",">=","<="].includes(tokens[i])) {
            left += tokens[i];
            i++;
        }

        op = tokens[i++];
        while (i < tokens.length) {
            right += tokens[i];
            i++;
        }
        let L = evalValue(left.trim(), vars);
        let R = evalValue(right.trim(), vars);

        switch (op) {
            case "==": return L == R;
            case "!=": return L != R;
            case ">":  return L > R;
            case "<":  return L < R;
            case ">=": return L >= R;
            case "<=": return L <= R;
        }

        throw "ConditionError: invalid operator " + op;
    }

    /* ============================================================
            FOR HELPERS
    ============================================================ */

    function runForInit(text, vars) {
        if (text.startsWith("var(")) {
            let name = text.slice(4, text.indexOf(")"));
            let value = text.split("=")[1];
            vars[name] = Number(value);
            return;
        }

        if (text.includes("=")) {
            let [name, value] = text.split("=");
            vars[name] = Number(value);
            return;
        }

        throw "Invalid for initializer: " + text;
    }

    function runForInc(text, vars) {
        if (text.startsWith("+")) vars[text.slice(1)]++;
        else if (text.startsWith("-")) vars[text.slice(1)]--;
        else throw "Invalid for increment: " + text;
    }

    /* ============================================================
            MAIN EXECUTION LOOP
    ============================================================ */

    while (callStack.length > 0) {
        let frame = callStack[callStack.length - 1];
        let { vars, commands, ip } = frame;

        if (ip >= commands.length) {
            callStack.pop();
            continue;
        }

        let cmd = commands[ip];
        frame.ip++;

        const op = cmd[0];

        if (op === "call") {
            const name = cmd[1];
            const args = cmd[2];

            if (!(name in funcTable)) throw "CallError: function " + name + " not defined";

            let def = funcTable[name];
            let params = def.params;

            if (args.length > params.length)
                throw "CallError: too many arguments for " + name;

            let local = {};

            for (let i = 0; i < params.length; i++) {
                if (i < args.length) local[params[i]] = evalValue(args[i], vars);
                else local[params[i]] = 1;
            }

            callStack.push({
                vars: local,
                commands: parse(tokenize(def.body.join(" "))),

                ip: 0
            });

            continue;
        }

        if (op === "if_start") {
            const cond = cmd[1];
            const result = evalCondition(cond, vars);

            if (!frame.blockStack) frame.blockStack = [];
            frame.blockStack.push({
                type: "if",
                active: result,
                branchTaken: result
            });
            continue;
        }

        if (op === "or_start") {
            let block = frame.blockStack[frame.blockStack.length - 1];
            const cond = cmd[1];
            const result = evalCondition(cond, vars);

            block.active = !block.branchTaken && result;
            if (result) block.branchTaken = true;

            continue;
        }

        if (op === "else_start") {
            let block = frame.blockStack[frame.blockStack.length - 1];
            block.active = !block.branchTaken;
            block.branchTaken = true;
            continue;
        }

        if (op === "for_start") {
            const init = cmd[1];
            const cond = cmd[2];
            const inc = cmd[3];

            runForInit(init, vars);

            if (!frame.blockStack) frame.blockStack = [];
            frame.blockStack.push({
                type: "for",
                cond,
                inc,
                active: evalCondition(cond, vars)
            });
            continue;
        }

        if (op === "end_block") {
            let block = frame.blockStack.pop();

            if (block.type === "for") {
                runForInc(block.inc, vars);

                if (evalCondition(block.cond, vars)) {
                    frame.blockStack.push(block);
                }
            }
            continue;
        }

        if (frame.blockStack && frame.blockStack.some(b => !b.active)) continue;

        if (op === "say_concat") {
            let out = "";
            for (let p of cmd[1]) out += String(evalValue(p, vars));
            print(out);
            continue;
        }

        if (op === "var_decl") {
            vars[cmd[1]] = null;
            continue;
        }

        if (op === "var_set") {
            vars[cmd[1]] = evalValue(cmd[2], vars);
            continue;
        }

        if (op === "input") {
            vars[cmd[1]] = await waitForInput();
            continue;
        }
    }

    return globalVars;
}

/* ============================================================
        AUTO-BRACE
============================================================ */

document.getElementById("codeBox").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        const textarea = this;
        const start = textarea.selectionStart;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(start);

        if (before.trimEnd().endsWith("{")) {
            e.preventDefault();
            const insert = "\n\t\n}";
            textarea.value = before + insert + after;
            textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
    }
});

/* ============================================================
        RUNNER
============================================================ */

async function runPyC(code) {
    const tokens = tokenize(code);
    const commands = parse(tokens);
    await execute(commands, {});
}

document.getElementById("runBtn").addEventListener("click", () => {
    const output = document.getElementById("output");
    output.innerHTML = "";

    const code = document.getElementById("codeBox").value;

    runPyC(code).catch(err => {
        output.innerHTML += `<span style="color:red">${err}</span>`;
        console.error(err);
    });
});
