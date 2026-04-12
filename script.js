// IF block
if (cmd[0] === "if_start") {
    const cond = cmd[1];
    const result = evalCondition(cond, vars);

    blockStack.push({
        type: "if",
        active: result,
        branchTaken: result
    });
    continue;
}

// OR block
if (cmd[0] === "or_start") {
    const block = blockStack[blockStack.length - 1];
    const cond = cmd[1];
    const result = evalCondition(cond, vars);

    block.active = !block.branchTaken && result;
    if (result) block.branchTaken = true;

    continue;
}

// ELSE block
if (cmd[0] === "else_start") {
    const block = blockStack[blockStack.length - 1];

    block.active = !block.branchTaken;
    block.branchTaken = true;

    continue;
}

// END block
if (cmd[0] === "end_block") {
    blockStack.pop();
    continue;
}

// Skip inactive blocks
if (blockStack.some(b => !b.active)) continue;
