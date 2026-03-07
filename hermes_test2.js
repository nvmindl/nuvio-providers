// Test Hermes features WITHOUT with() since it's a parse error
print("=== Hermes Feature Tests ===");
print("");

// Test 1: Unicode RegExp Property Escapes
print("--- Test 1: Unicode \\p{L} regex ---");
try {
    var re = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');
    var result = 'hello world 123!@#'.replace(re, ' ');
    print("PASS: " + JSON.stringify(result));
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 2: Proxy
print("");
print("--- Test 2: Proxy ---");
try {
    var handler = {
        has: function(target, key) { return true; },
        get: function(target, key) {
            if (key in target) return target[key];
            return undefined;
        },
        set: function(target, key, value) {
            target[key] = value;
            return true;
        }
    };
    var p = new Proxy({x: 42}, handler);
    print("PASS: p.x = " + p.x + ", p.missing = " + p.missing);
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 3: new Function()
print("");
print("--- Test 3: new Function() ---");
try {
    var fn = new Function('x', 'return x * 2;');
    print("PASS: fn(21) = " + fn(21));
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 4: new Function() with with() inside string (the key question!)
print("");
print("--- Test 4: new Function with with() inside ---");
try {
    var scope = { myVar: 99 };
    var fn2 = new Function('scope', 'with(scope){ return myVar; }');
    var val = fn2(scope);
    print("PASS: myVar = " + val);
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 5: new Function() with with() + Proxy (our exact sandbox pattern)
print("");
print("--- Test 5: Full sandbox pattern (Function+with+Proxy) ---");
try {
    var captured = '';
    var scope2 = {
        document: { write: function(s) { captured += s; } },
        parseInt: parseInt,
        String: String,
        Math: Math,
    };
    var proxy2 = new Proxy(scope2, {
        has: function(target, key) {
            if (key === Symbol.unscopables) return false;
            return true;
        },
        get: function(target, key) {
            if (key === Symbol.unscopables) return undefined;
            if (key in target) return target[key];
            return undefined;
        },
        set: function(target, key, value) {
            target[key] = value;
            return true;
        }
    });
    scope2.window = proxy2;

    var executor = new Function('scope', 'with(scope){\n document.write("Hello from sandbox " + Math.PI); \n}');
    executor(proxy2);
    print("PASS: captured = " + captured);
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 6: Symbol.unscopables
print("");
print("--- Test 6: Symbol.unscopables ---");
try {
    print("PASS: " + String(Symbol.unscopables));
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 7: atob/btoa
print("");
print("--- Test 7: atob/btoa ---");
try {
    print("btoa: " + (typeof btoa));
    print("atob: " + (typeof atob));
} catch(e) {
    print("NOT AVAILABLE: " + e.message);
}

// Test 8: Generators
print("");
print("--- Test 8: Generators ---");
try {
    function* gen() { yield 1; yield 2; yield 3; }
    var g = gen();
    var vals = [];
    var next;
    while (!(next = g.next()).done) vals.push(next.value);
    print("PASS: " + JSON.stringify(vals));
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 9: Spread operator
print("");
print("--- Test 9: Spread operator ---");
try {
    var a = {x: 1};
    var b = Object.assign({}, a, {y: 2});
    print("PASS: " + JSON.stringify(b));
} catch(e) {
    print("FAIL: " + e.message);
}

print("");
print("=== All tests complete ===");
