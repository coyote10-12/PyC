function tokenize(code) {
    return code.match(/'[^']*'|[A-Za-z_]\w*|==|!=|<=|>=|[{}();=]|[0-9]+/g);
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

function execute(commands) {
    const vars = {};

    for (const cmd of commands) {
        const op = cmd[0];

        if (op === "say") {
            const value = cmd[1];
            if (value in vars) console.log(vars[value]);
            else console.log(value);
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
            vars[name] = prompt("> ");
        }
    }

    return vars;
}

function runPyC(code) {
    const tokens = tokenize(code);
    const commands = parse(tokens);
    return execute(commands);
}
