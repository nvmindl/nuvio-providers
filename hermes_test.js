// Test all features our extractor uses in Hermes
print("=== Hermes Feature Tests ===");
print("");

// Test 1: Unicode RegExp Property Escapes
print("--- Test 1: Unicode \\p{L} regex ---");
try {
    var re = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');
    var result = 'hello مرحبا 123!@#'.replace(re, ' ');
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

// Test 3: with() statement
print("");
print("--- Test 3: with() statement ---");
try {
    var obj = { a: 10, b: 20 };
    var result;
    with(obj) {
        result = a + b;
    }
    print("PASS: a + b = " + result);
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 4: new Function()
print("");
print("--- Test 4: new Function() ---");
try {
    var fn = new Function('x', 'return x * 2;');
    print("PASS: fn(21) = " + fn(21));
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 5: with() + Proxy combined (our exact pattern)
print("");
print("--- Test 5: with(Proxy) combined ---");
try {
    var scope = { myVar: 'hello' };
    var proxyScope = new Proxy(scope, {
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
    
    var resultVal;
    with(proxyScope) {
        resultVal = myVar;
    }
    print("PASS: myVar = " + resultVal);
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 6: new Function() + with(Proxy) combined (exact sandbox pattern)
print("");
print("--- Test 6: new Function('scope', 'with(scope){...}') ---");
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

// Test 7: Symbol.unscopables
print("");
print("--- Test 7: Symbol.unscopables ---");
try {
    print("PASS: Symbol.unscopables = " + String(Symbol.unscopables));
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 8: atob/btoa
print("");
print("--- Test 8: atob/btoa ---");
try {
    var encoded = btoa("hello");
    print("btoa: " + encoded);
    var decoded = atob(encoded);
    print("PASS: atob = " + decoded);
} catch(e) {
    print("NOT AVAILABLE (expected): " + e.message);
}

// Test 9: Generators (from async/await transpilation)  
print("");
print("--- Test 9: Generators ---");
try {
    function* gen() {
        yield 1;
        yield 2;
        yield 3;
    }
    var g = gen();
    var vals = [];
    var next;
    while (!(next = g.next()).done) {
        vals.push(next.value);
    }
    print("PASS: " + JSON.stringify(vals));
} catch(e) {
    print("FAIL: " + e.message);
}

// Test 10: fetch (likely not available in CLI)
print("");
print("--- Test 10: fetch ---");
try {
    print(typeof fetch === 'function' ? "AVAILABLE" : "NOT AVAILABLE (expected in CLI)");
} catch(e) {
    print("NOT AVAILABLE: " + e.message);
}

print("");
print("=== All tests complete ===");
