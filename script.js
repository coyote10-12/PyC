/* ============================================================
        TOKENIZER (updated for def + calls)
============================================================ */

function tokenize(code) {
    return code.match(/'[^']*'|==|!=|<=|>=|def|[A-Za-z_]\w*|\d+|[(){};,=+\-*/<>]/g) || [];
}

/* ============================================================
        PARSER (updated for functions)
============================================================ */

function parse(tokens) {
    const commands = [];
    let i = 0;

    // Function table: name -> { params:[], body:[] }
    const functions = {};

    function parseFunction() {
        // def name ( a , b , c ) { body }
        i++; // skip 'def'

        const name = tokens[i];
        if (!/^[A-Za-z_]\w*$/.test(name)) throw "SyntaxError: invalid function name";
        i++;

        if (tokens[i] !== "(") throw "SyntaxError: expected ( after function name";
        i++;

        let params = [];
        while (tokens[i] !== ")") {
            if (!/^[A-Za-z_]\w*$/.test(tokens[i])) throw "SyntaxError: invalid parameter name";
            params.push(tokens[i]);
            i++;

            if (tokens[i] === ",") {
                i++;
                continue;
            }

            if (tokens[i] !== ")" && tokens[i] !== ",")
                throw "SyntaxError: expected , or ) in parameter list";
        }
        i++; // skip ')'

        if (tokens[i] !== "{") throw "SyntaxError: expected { after def(...)";
        i++;

        let body = [];
        let depth = 1;

        while (i < tokens.length && depth > 0) {
            if (tokens[i] === "{") depth++;
            if (tokens[i] === "}") depth--;

            if (depth > 0) body.push(tokens[i]);
            i++;
        }

        functions[name] = { params, body };
    }

    function parseFunctionCall(name) {
        // name ( args )
        i++; // skip name
        i++; // skip '('

        let args = [];
        let current = "";

        while (tokens[i] !== ")") {
            if (tokens[i] === ",") {
                args.push(current.trim());
                current = "";
                i++;
                continue;
            }
            current += tokens[i];
            i++;
        }

        if (current.trim() !== "") args.push(current.trim());
        i++; // skip ')'

        commands.push(["call", name, args]);
    }

    while (i < tokens.length) {
        const tok = tokens[i];

        /* ---------------- FUNCTION DEFINITION ---------------- */
        if (tok === "def") {
            parseFunction();
            continue;
        }

        /* ---------------- FUNCTION CALL ---------------- */
        if (/^[A-Za-z_]\w*$/.test(tok) && tokens[i+1] === "(") {
            parseFunctionCall(tok);
            continue;
        }

        /* ---------------- EXISTING PARSER LOGIC ---------------- */
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

            let init = "";
            while (tokens[j] !== ";") {
                if (j >= tokens.length) throw "SyntaxError: missing ; in for initializer";
                init += tokens[j];
                j++;
            }
            j++;

            let cond = "";
            while (tokens[j] !== ";") {
                if (j >= tokens.length) throw "SyntaxError: missing ; in for condition";
                cond += tokens[j];
                j++;
            }
            j++;

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
            let current = "";
        
            while (tokens[j] !== ")") {
                if (tokens[j] === "&") {
                    if (current.trim() !== "") {
                        parts.push(current.trim());
                        current = "";
                    }
                    j++;
                    continue;
                }
                current += tokens[j];
                j++;
                if (j >= tokens.length) throw "SyntaxError: missing ) in say(...)";
            }
        
            if (current.trim() !== "") parts.push(current.trim());
        
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

    commands.push(["functions", functions]);
    return commands;
}

/* ============================================================
        FUNCTION EXECUTION ENGINE
============================================================ */

async function execute(commands, globalVars = {}) {
    const output = document.getElementById("output");

    function print(text) {
        output.innerHTML += text + "<br>";
        output.scrollTop = output.scrollHeight;
    }

    // Extract function table
    let funcTable = {};
    for (let cmd of commands) {
        if (cmd[0] === "functions") {
            funcTable = cmd[1];
        }
    }

    // Call stack: each frame = { vars, commands, ip }
    let callStack = [];

    // Push main program frame
    callStack.push({
        vars: globalVars,
        commands: commands,
        ip: 0
    });

    /* ========================================================
            HELPERS
    ======================================================== */

    function evalValue(token, vars) {
        // String literal
        if (token[0] === "'" && token[token.length - 1] === "'") {
            return token.substring(1, token.length - 1);
        }

        // Math expression
        if (/[\d()+\-*/^]/.test(token)) {
            let mtokens = tokenize(token);
            let tree = parseMath(mtokens);
            return evalMath(tree, vars);
        }

        // Variable
        if (token in vars) return vars[token];

        throw "Unknown value: " + token;
    }

    function runForInit(text, vars) {
        // var(i)=0
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

    /* ========================================================
            MAIN EXECUTION LOOP
    ======================================================== */

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

        /* ---------------- FUNCTION CALL ---------------- */
        if (op === "call") {
            const name = cmd[1];
            const args = cmd[2];

            if (!(name in funcTable)) throw "CallError: function " + name + " not defined";

            let def = funcTable[name];
            let params = def.params;

            if (args.length > params.length)
                throw "CallError: too many arguments for " + name;

            // Build local scope
            let local = {};

            for (let i = 0; i < params.length; i++) {
                if (i < args.length) {
                    local[params[i]] = evalValue(args[i], vars);
                } else {
                    local[params[i]] = 1; // missing args default to 1
                }
            }

            // Push new frame
            callStack.push({
                vars: local,
                commands: parse(tokenize(def.body.join(" "))),
                ip: 0
            });

            continue;
        }

        /* ---------------- IF ---------------- */
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

        /* ---------------- OR ---------------- */
        if (op === "or_start") {
            let block = frame.blockStack[frame.blockStack.length - 1];
            const cond = cmd[1];
            const result = evalCondition(cond, vars);

            block.active = !block.branchTaken && result;
            if (result) block.branchTaken = true;

            continue;
        }

        /* ---------------- ELSE ---------------- */
        if (op === "else_start") {
            let block = frame.blockStack[frame.blockStack.length - 1];

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

            if (!frame.blockStack) frame.blockStack = [];
            frame.blockStack.push({
                type: "for",
                cond,
                inc,
                active: evalCondition(cond, vars)
            });
            continue;
        }

        /* ---------------- END BLOCK ---------------- */
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

        /* Skip inactive blocks */
        if (frame.blockStack && frame.blockStack.some(b => !b.active)) continue;

        /* ---------------- SAY ---------------- */
        if (op === "say_concat") {
            let parts = cmd[1];
            let out = "";

            for (let p of parts) {
                out += evalValue(p, vars);
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

            vars[name] = evalValue(value, vars);
            continue;
        }

        /* ---------------- INPUT ---------------- */
        if (op === "input") {
            const name = cmd[1];
            vars[name] = await waitForInput();
            continue;
        }
    }

    return globalVars;
}

/* ============================================================
        AUTO-BRACE (updated for def { } blocks)
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
        if (before.trimEnd().endsWith("{")) {
            e.preventDefault();

            const insert = "\n\t\n}";

            textarea.value = before + insert + after;

            // Cursor goes on the indented blank line
            textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
    }
});

/* ============================================================
        RUNNER
============================================================ */

async function runPyC(code) {
    const tokens = tokenize(code);
    console.log("TOKENS:", tokens);

    const commands = parse(tokens);
    console.log("COMMANDS:", commands);

    const vars = await execute(commands, {});
    console.log("FINAL VARS:", vars);
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

