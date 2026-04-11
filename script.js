function tokenize(code) {
    const tokens = code.match(/'[^']*'|[A-Za-z_]\w*|==|!=|<=|>=|[{}();=]|[0-9]+/g);
    return tokens || [];
}

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

function parse(tokens) {
    const commands = [];
    let i = 0;

    while (i < tokens.length) {
        const tok = tokens[i];

        if (tok === ";") {
            i++;
            continue;
        }

        if (tok === "say") {
            if (tokens[i+1] !== "(") throw "SyntaxError: expected (";
            const value = tokens[i+2];
            if (tokens[i+3] !== ")") throw "SyntaxError: expected )";
            commands.push(["say", value.replace(/'/g, "")]);
            i += 4;
        }

        else if (tok === "var") {
            const name = tokens[i+1];

            if (tokens[i+2] === "=") {
                const value = tokens[i+3];
                commands.push(["var_set", name, value.replace(/'/g, "")]);
                i += 4;
            } else {
                commands.push(["var_decl", name]);
                i += 2;
            }
        }

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
