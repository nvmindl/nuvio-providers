// Test alternative sandbox approaches in Hermes (no with())
print("=== Alternative Sandbox Tests ===");
print("");

// The problem: the obfuscated script references `document`, `window`, `jQuery`, etc
// as bare global names. We can't use with() to intercept them.

// Approach 1: Pass globals as Function parameters
print("--- Approach 1: Named parameters ---");
try {
    var captured = '';
    var mockDoc = { write: function(s) { captured += s; } };
    
    // Create function with explicit parameter names for all globals the script uses
    var fn = new Function('document', 'window', 'jQuery', '$',
        'document.write("Hello " + 42);'
    );
    fn(mockDoc, {}, function(){}, function(){});
    print("PASS: " + captured);
} catch(e) {
    print("FAIL: " + e.message);
}

// Approach 2: Wrap script in an IIFE that destructures from a globals object
print("");
print("--- Approach 2: Destructure wrapper ---");
try {
    var captured2 = '';
    var mockDoc2 = { write: function(s) { captured2 += s; } };
    var globals = {
        document: mockDoc2,
        window: {},
        parseInt: parseInt,
        Math: Math,
    };
    
    // Wrap script: var document=g.document, window=g.window, ...; <script>
    var paramNames = Object.keys(globals);
    var varDecls = paramNames.map(function(n) { return n + '=__g.' + n; }).join(',');
    var wrapped = 'var ' + varDecls + ';\n' + 'document.write("Value: " + Math.floor(3.7));';
    
    var fn2 = new Function('__g', wrapped);
    fn2(globals);
    print("PASS: " + captured2);
} catch(e) {
    print("FAIL: " + e.message);
}

// Approach 3: Test with actual obfuscated-style code that uses window[prop]
print("");
print("--- Approach 3: Script that accesses window ---");
try {
    var captured3 = '';
    var mockDoc3 = { write: function(s) { captured3 += s; } };
    var mockWindow = { document: mockDoc3 };
    
    // Simulated obfuscated script that does: window['document']['write']('test')
    var script = "window['document']['write']('from window');";
    var wrapped3 = 'var document=__g.document, window=__g.window, self=__g.window;\n' + script;
    var fn3 = new Function('__g', wrapped3);
    fn3({ document: mockDoc3, window: mockWindow });
    print("PASS: " + captured3);
} catch(e) {
    print("FAIL: " + e.message);
}

// Approach 4: The big question - can we redeclare ALL possible _0x vars?
// The obfuscated script declares its own vars. We just need document, window, etc.
print("");
print("--- Approach 4: Full mock with real-ish obfuscated pattern ---");
try {
    var captured4 = '';
    var mockDoc4 = { write: function(s) { captured4 += s; } };
    
    // Simulate real obfuscated script pattern:
    // (function(_0x1234, _0x5678){ ... }(_0xabcd(), 123456))
    var testScript = [
        '(function() {',
        '  var _0xabc = function() { return ["hello", "write", "document"]; };',
        '  var _0xarr = _0xabc();',
        '  document[_0xarr[1]](_0xarr[0]);',
        '})();'
    ].join('\n');
    
    var paramList = 'document,window,self,navigator,location,jQuery,$,setTimeout,setInterval,clearTimeout,clearInterval,console,parseInt,parseFloat,isNaN,isFinite,String,Number,Array,Object,Boolean,RegExp,Error,TypeError,Math,Date,JSON,encodeURIComponent,decodeURIComponent,encodeURI,decodeURI,NaN,Infinity,atob,btoa,Cookies';
    
    var fn4 = new Function(paramList, testScript);
    fn4(
        mockDoc4, // document
        {}, // window  
        {}, // self
        { userAgent: 'Mozilla/5.0' }, // navigator
        { href: '', hostname: '' }, // location
        function(){return{on:function(){return this;}}}, // jQuery
        function(){return{on:function(){return this;}}}, // $
        function(){return 1;}, // setTimeout
        function(){return 1;}, // setInterval
        function(){}, // clearTimeout
        function(){}, // clearInterval
        {log:function(){},warn:function(){},error:function(){}}, // console
        parseInt, parseFloat, isNaN, isFinite,
        String, Number, Array, Object, Boolean, RegExp, Error, TypeError,
        Math, Date, JSON,
        encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
        NaN, Infinity,
        atob, btoa,
        { get: function(){return null;}, set: function(){} } // Cookies
    );
    print("PASS: " + captured4);
} catch(e) {
    print("FAIL: " + e.message);
}

// Approach 5: var-declaration wrapper (simpler)
print("");
print("--- Approach 5: var-declaration wrapper (best approach) ---");
try {
    var captured5 = '';
    var mockDoc5 = { write: function(s) { captured5 += s; } };
    
    // Just pass a single globals object and generate var declarations
    var testScript2 = 'document.write("works! " + parseInt("42"));';
    var globals5 = {
        document: mockDoc5,
        window: {},
        parseInt: parseInt,
        Math: Math,
    };
    
    var names = Object.keys(globals5);
    var preamble = 'var ' + names.map(function(n) { return n + '=__scope__.' + n; }).join(', ') + ';\n';
    
    var fn5 = new Function('__scope__', preamble + testScript2);
    fn5(globals5);
    print("PASS: " + captured5);
} catch(e) {
    print("FAIL: " + e.message);
}

print("");
print("=== Tests complete ===");
