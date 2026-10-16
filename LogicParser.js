function LogicParser(npn) {
    function isLeaf(n) {
        return typeof n === "string";
    }

    function bddAnd(a, b) {
        if (isLeaf(a) && isLeaf(b)) return (a === "1" && b === "1") ? "1" : "0";
        if (isLeaf(a)) return a === "0" ? "0" : b;
        if (isLeaf(b)) return b === "0" ? "0" : a;
        var va = a.S, vb = b.S;
        if (va === vb) return { S: va, "0": bddAnd(a["0"], b["0"]), "1": bddAnd(a["1"], b["1"]) };
        if (va < vb)  return { S: va, "0": bddAnd(a["0"], b),      "1": bddAnd(a["1"], b) };
        return             { S: vb, "0": bddAnd(a, b["0"]),      "1": bddAnd(a, b["1"]) };
    }

    function bddOr(a, b) {
        if (isLeaf(a) && isLeaf(b)) return (a === "1" || b === "1") ? "1" : "0";
        if (isLeaf(a)) return a === "1" ? "1" : b;
        if (isLeaf(b)) return b === "1" ? "1" : a;
        var va = a.S, vb = b.S;
        if (va === vb) return { S: va, "0": bddOr(a["0"], b["0"]), "1": bddOr(a["1"], b["1"]) };
        if (va < vb)  return { S: va, "0": bddOr(a["0"], b),      "1": bddOr(a["1"], b) };
        return             { S: vb, "0": bddOr(a, b["0"]),      "1": bddOr(a, b["1"]) };
    }

    function bddNot(a) {
        if (isLeaf(a)) return a === "0" ? "1" : "0";
        return { S: a.S, "0": bddNot(a["0"]), "1": bddNot(a["1"]) };
    }

    function bddRestrict(a, x, c) {
        if (isLeaf(a)) return a;
        if (a.S === x) return c === "0" ? a["0"] : a["1"];
        return { S: a.S, "0": bddRestrict(a["0"], x, c), "1": bddRestrict(a["1"], x, c) };
    }

    function hasVar(a, x) {
        if (isLeaf(a)) return false;
        if (a.S === x) return true;
        return hasVar(a["0"], x) || hasVar(a["1"], x);
    }

    function bddForall(a, x) {
        if (!hasVar(a, x)) return a;
        return bddAnd(bddRestrict(a, x, "0"), bddRestrict(a, x, "1"));
    }

    function bddExists(a, x) {
        if (!hasVar(a, x)) return a;
        return bddOr(bddRestrict(a, x, "0"), bddRestrict(a, x, "1"));
    }

    function andM(a, b)  { return bddAnd(a, b); }
    function orM(a, b)   { return bddOr(a, b); }
    function notM(a)     { return bddNot(a); }
    function infM(a, b)  { return bddOr(bddNot(a), b); }
    function equalM(a, b){ return bddOr(bddAnd(a, b), bddAnd(bddNot(a), bddNot(b))); }

    if (npn === "" || npn === undefined || npn === null) return "Empty String!";

    var tokens = npn.split(/(\.|,|<|>|=|@|#|\s)/);
    var stack = [];
    var i = 0;

    function nextToken() {
        while (i < tokens.length) {
            var tok = tokens[i++];
            if (tok === "" || /^\s+$/.test(tok)) continue;
            return tok;
        }
        return null;
    }

    while (i < tokens.length) {
        var tok = tokens[i++];
        if (tok === "" || /^\s+$/.test(tok)) continue;

        if (tok === "." || tok === "," || tok === ">" || tok === "=") {
            if (stack.length < 2) return "Format Error: arguments less than needed";
            var b = stack.pop();
            var a = stack.pop();
            var r;
            if (tok === ".")      r = andM(a, b);
            else if (tok === ",") r = orM(a, b);
            else if (tok === ">") r = infM(a, b);
            else                  r = equalM(a, b);
            stack.push(r);
        }
        else if (tok === "<") {
            if (stack.length < 1) return "Format Error: arguments less than needed";
            stack.push(notM(stack.pop()));
        }
        else if (tok === "@" || tok === "#") {
            var x = nextToken();
            if (x === null) return "Format Error: " + tok + " needs a variable name";
            if (x === "." || x === "," || x === "<" || x === ">" || x === "=" ||
                x === "@" || x === "#") {
                return "Format Error: " + tok + " needs a variable name, got operator";
            }
            if (stack.length < 1) return "Format Error: " + tok + " needs an expression";
            var expr = stack.pop();
            if (tok === "@") stack.push(bddForall(expr, x));
            else             stack.push(bddExists(expr, x));
        }
        else {
            // ★ 关键修复：把变量名包装成 BDD 节点
            stack.push({ S: tok, "0": "0", "1": "1" });
        }
    }

    if (stack.length === 0) return "Format Error: empty result";
    if (stack.length > 1)   return "Format Error: arguments more than needed";
    return stack.pop();
};