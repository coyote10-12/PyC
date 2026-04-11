function tokenize(code) {
    const tokens = code.match(/'[^']*'|[A-Za-z_]\w*|==|!=|<=|>=|&|[{}();=]|[0-9]+/g);
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

/* Execute PyC commands (async for input) */
async function execute(commands, vars = {}) {
    const output = document.getElementById("output");

    function print(text) {
        output.innerHTML += text + "<br>";
        output.scrollTop = output.scrollHeight;
    }

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const op = cmd[0];

        if (op === "say") {
            const value = cmd[1];
            if (value in vars) print(vars[value]);
            else print(value);
        }

        else if (op === "say_concat") {
            let parts = cmd[1];
            let out = "";

            for (let p of parts) {
                if (p.startsWith("'") && p.endsWith("'")) {
                    out += p.slice(1, -1);
                } else if (p in vars) {
                    out += vars[p];
                } else {
                    throw "Unknown value: " + p;
                }
            }

            print(out);
        }

        else if (op === "var_decl") {
            vars[cmd[1]] = null;
        }

        else if (op === "var_set") {
            const name = cmd[1];
            const value = cmd[2];
            vars[name] = /^\d+$/.test(value) ? Number(value) : value;
        }

        else if (op === "input") {
            const name = cmd[1];
            const value = await waitForInput();
            vars[name] = value;
        }
    }

    return vars;
}

/* Parse PyC code into commands */
function parse(tokens) {
    const commands = [];
    let i = 0;

    while (i < tokens.length) {
        const tok = tokens[i];

        if (tok === ";") {
            i++;
            continue;
        }

        /* say('text' & var & 'text') */
        if (tok === "say") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected (";

            let j = i + 2;
            let parts = [];

            while (tokens[j] !== ")") {
                if (tokens[j] === "&") {
                    j++;
                    continue;
                }
                parts.push(tokens[j]);
                j++;
            }

            commands.push(["say_concat", parts]);
            i = j + 1;
        }

        /* var name or var name = value */
        else if (tok === "var") {
            const name = tokens[i+1];

            if (tokens[i+2] === "=") {
                const value = tokens[i+3];
                commands.push(["var_set", name, value]);
                i += 4;
            } else {
                commands.push(["var_decl", name]);
                i += 2;
            }
        }

        /* ret(name) */
        else if (tok === "ret") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected (";
            const name = tokens[i+2];
            if (tokens[i+3] !== ")") throw "SyntaxError: expected )";
            commands.push(["input", name]);
            i += 4;
        }

        else {
            throw "Unknown token: " + tok;
        }
    }

    return commands;
}

/* Run PyC program */
async function runPyC(code) {
    const tokens = tokenize(code);
    const commands = parse(tokens);
    return await execute(commands);
}

/* Run from editor */
function runPyCFromEditor() {
    const output = document.getElementById("output");
    output.innerHTML = "";

    const code = document.getElementById("codeBox").value;

    runPyC(code).catch(err => {
        output.innerHTML += "<span style='color:red'>" + err + "</span>";
    });
}
