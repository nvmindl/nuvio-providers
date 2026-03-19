/**
 * faselhdx - Built from src/faselhdx/
 * Generated: 2026-03-19T20:25:20.217Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/faselhdx/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));

// src/faselhdx/http.js
var DOMAIN_BASE = "faselhdx";
var MAIN_DOMAIN = "https://www.fasel-hd.cam";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
var activeDomain = "https://web31918x.faselhdx.best";
var domainCheckedAt = 0;
var DOMAIN_TTL = 5 * 60 * 1e3;
function safeFetch(url, opts) {
  opts = opts || {};
  var ms = opts.timeout || 15e3;
  var controller;
  var tid;
  try {
    controller = new AbortController();
    tid = setTimeout(function() {
      controller.abort();
    }, ms);
  } catch (e) {
    controller = null;
  }
  var fetchOpts = {
    method: opts.method || "GET",
    redirect: opts.redirect || "follow",
    headers: Object.assign({}, HEADERS, opts.headers || {})
  };
  if (controller)
    fetchOpts.signal = controller.signal;
  return fetch(url, fetchOpts).then(function(r) {
    if (tid)
      clearTimeout(tid);
    return r;
  }).catch(function(e) {
    if (tid)
      clearTimeout(tid);
    throw e;
  });
}
function fetchText(url, opts) {
  return safeFetch(url, opts).then(function(r) {
    if (r.status === 403 || r.status === 429) {
      return new Promise(function(resolve) {
        setTimeout(resolve, 1500);
      }).then(function() {
        return safeFetch(url, opts);
      }).then(function(r2) {
        if (!r2.ok) {
          console.log("[FaselHD] fetchText " + r2.status + " for " + url.substring(0, 80));
          return "";
        }
        return r2.text();
      }).catch(function() {
        return "";
      });
    }
    if (!r.ok) {
      console.log("[FaselHD] fetchText " + r.status + " for " + url.substring(0, 80));
      return "";
    }
    return r.text();
  }).catch(function(e) {
    console.log("[FaselHD] fetchText error: " + e.message + " for " + url.substring(0, 80));
    return "";
  });
}
function probe(domain) {
  return safeFetch(domain + "/", { redirect: "manual", timeout: 3e3 }).then(function(resp) {
    if (resp.status === 200)
      return domain;
    if (resp.status === 301 || resp.status === 302) {
      var loc = resp.headers.get("location") || "";
      var m = loc.match(/https?:\/\/web\d+x\.faselhdx\.[a-z]+/);
      if (m) {
        var target = m[0].replace(/^http:/, "https:");
        return safeFetch(target + "/", { redirect: "manual", timeout: 3e3 }).then(function(r2) {
          return r2.status === 200 ? target : null;
        }).catch(function() {
          return null;
        });
      }
    }
    return null;
  }).catch(function() {
    return null;
  });
}
function discoverDomain() {
  return __async(this, null, function* () {
    var t0 = Date.now();
    var numMatch = activeDomain.match(/web(\d+)x\.faselhdx\.([a-z]+)/);
    var quickCandidates = [];
    if (activeDomain !== MAIN_DOMAIN && activeDomain.indexOf(DOMAIN_BASE) > -1) {
      quickCandidates.push(activeDomain);
    }
    if (numMatch) {
      var num = numMatch[1];
      var tlds = ["best", "xyz"];
      for (var t = 0; t < tlds.length; t++) {
        var d = "https://web" + num + "x." + DOMAIN_BASE + "." + tlds[t];
        if (d !== activeDomain)
          quickCandidates.push(d);
      }
    }
    if (quickCandidates.length > 0) {
      try {
        var result = yield Promise.any(
          quickCandidates.map(function(d2) {
            return probe(d2).then(function(r) {
              return r || Promise.reject();
            });
          })
        );
        if (result) {
          activeDomain = result;
          domainCheckedAt = Date.now();
          console.log("[FaselHD] Domain: " + result + " (" + (Date.now() - t0) + "ms)");
          return result;
        }
      } catch (e) {
      }
    }
    var lastNum = numMatch ? parseInt(numMatch[1]) : 31912;
    console.log("[FaselHD] Scanning from " + lastNum + "...");
    var allCandidates = [];
    for (var dist = 0; dist <= 50; dist++) {
      var signs = [1, -1];
      for (var si = 0; si < signs.length; si++) {
        var n = lastNum + dist * signs[si];
        if (n < 1)
          continue;
        var tlds2 = ["best", "xyz"];
        for (var ti = 0; ti < tlds2.length; ti++) {
          allCandidates.push("https://web" + n + "x." + DOMAIN_BASE + "." + tlds2[ti]);
        }
      }
    }
    var seen = {};
    var unique = [];
    for (var i = 0; i < allCandidates.length; i++) {
      if (!seen[allCandidates[i]]) {
        seen[allCandidates[i]] = true;
        unique.push(allCandidates[i]);
      }
    }
    var CONCURRENCY = 15;
    var found = null;
    try {
      found = yield new Promise(function(resolve, reject) {
        var idx = 0, inFlight = 0, done = false;
        var timer = setTimeout(function() {
          if (!done) {
            done = true;
            reject(new Error("timeout"));
          }
        }, 1e4);
        function launch() {
          while (inFlight < CONCURRENCY && idx < unique.length && !done) {
            var domain = unique[idx++];
            inFlight++;
            probe(domain).then(function(result2) {
              inFlight--;
              if (done)
                return;
              if (result2) {
                done = true;
                clearTimeout(timer);
                resolve(result2);
              } else {
                launch();
              }
              if (inFlight === 0 && idx >= unique.length && !done) {
                done = true;
                clearTimeout(timer);
                reject(new Error("exhausted"));
              }
            });
          }
        }
        launch();
        if (idx === 0) {
          done = true;
          clearTimeout(timer);
          reject(new Error("no candidates"));
        }
      });
    } catch (e) {
    }
    if (found) {
      activeDomain = found;
      domainCheckedAt = Date.now();
      console.log("[FaselHD] Discovered: " + found + " (" + (Date.now() - t0) + "ms)");
      return found;
    }
    console.log("[FaselHD] Discovery failed, using: " + activeDomain);
    domainCheckedAt = Date.now();
    return activeDomain;
  });
}
function getDomain() {
  return __async(this, null, function* () {
    if (Date.now() - domainCheckedAt > DOMAIN_TTL) {
      yield discoverDomain();
    }
    return activeDomain;
  });
}
function markDomainBad() {
  domainCheckedAt = 0;
}
function fetchFaselPage(url) {
  return __async(this, null, function* () {
    var html = yield fetchText(url);
    if (!html)
      return "";
    if (html.indexOf("Just a moment") > -1 || html.indexOf("Checking your browser") > -1 || html.length < 500) {
      console.log("[FaselHD] CF/dead domain detected, re-discovering...");
      markDomainBad();
      var newDomain = yield getDomain();
      var newUrl = url.replace(/https?:\/\/[^/]+/, newDomain);
      if (newUrl !== url) {
        html = yield fetchText(newUrl);
        if (html.indexOf("Just a moment") > -1)
          return "";
      }
      return html;
    }
    return html;
  });
}

// src/faselhdx/extractor.js
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function myAtob(str) {
  var output = "";
  var i = 0;
  str = String(str).replace(/[^A-Za-z0-9+/=]/g, "");
  while (i < str.length) {
    var a = B64.indexOf(str.charAt(i++));
    var b = B64.indexOf(str.charAt(i++));
    var c = B64.indexOf(str.charAt(i++));
    var d = B64.indexOf(str.charAt(i++));
    var n = a << 18 | b << 12 | c << 6 | d;
    output += String.fromCharCode(n >> 16 & 255);
    if (c !== 64)
      output += String.fromCharCode(n >> 8 & 255);
    if (d !== 64)
      output += String.fromCharCode(n & 255);
  }
  return output;
}
function myBtoa(str) {
  var output = "";
  for (var i = 0; i < str.length; ) {
    var a = str.charCodeAt(i++) || 0;
    var b = str.charCodeAt(i++) || 0;
    var c = str.charCodeAt(i++) || 0;
    output += B64.charAt(a >> 2);
    output += B64.charAt((a & 3) << 4 | b >> 4);
    output += i - 1 > str.length ? "=" : B64.charAt((b & 15) << 2 | c >> 6);
    output += i > str.length ? "=" : B64.charAt(c & 63);
  }
  return output;
}
function createMockElement() {
  var el = {
    style: {},
    innerHTML: "",
    textContent: "",
    src: "",
    id: "",
    href: "",
    className: "",
    type: "",
    setAttribute: function() {
    },
    getAttribute: function() {
      return "";
    },
    appendChild: function() {
      return el;
    },
    removeChild: function() {
      return el;
    },
    insertBefore: function() {
      return el;
    },
    querySelector: function() {
      return createMockElement();
    },
    querySelectorAll: function() {
      return [];
    },
    getElementsByTagName: function() {
      return [];
    },
    getElementsByClassName: function() {
      return [];
    },
    classList: { add: function() {
    }, remove: function() {
    }, contains: function() {
      return false;
    }, toggle: function() {
    } },
    addEventListener: function() {
    },
    removeEventListener: function() {
    },
    dataset: {},
    tagName: "DIV",
    nodeName: "DIV",
    offsetWidth: 1920,
    offsetHeight: 1080,
    clientWidth: 1920,
    clientHeight: 1080,
    parentNode: null,
    parentElement: null,
    childNodes: [],
    children: [],
    firstChild: null,
    lastChild: null,
    nextSibling: null,
    previousSibling: null,
    cloneNode: function() {
      return createMockElement();
    },
    dispatchEvent: function() {
      return true;
    },
    getBoundingClientRect: function() {
      return { top: 0, left: 0, bottom: 1080, right: 1920, width: 1920, height: 1080 };
    },
    scrollIntoView: function() {
    },
    focus: function() {
    },
    blur: function() {
    },
    click: function() {
    },
    remove: function() {
    }
  };
  el.parentNode = el;
  el.parentElement = el;
  return el;
}
function createJqResult() {
  var jq = {
    length: 0,
    ready: function(fn) {
      return jq;
    },
    on: function() {
      return jq;
    },
    off: function() {
      return jq;
    },
    find: function() {
      return jq;
    },
    each: function() {
      return jq;
    },
    css: function() {
      return jq;
    },
    addClass: function() {
      return jq;
    },
    removeClass: function() {
      return jq;
    },
    toggleClass: function() {
      return jq;
    },
    html: function() {
      return jq;
    },
    text: function() {
      return jq;
    },
    val: function() {
      return jq;
    },
    attr: function() {
      return jq;
    },
    prop: function() {
      return jq;
    },
    data: function() {
      return jq;
    },
    append: function() {
      return jq;
    },
    prepend: function() {
      return jq;
    },
    remove: function() {
      return jq;
    },
    empty: function() {
      return jq;
    },
    show: function() {
      return jq;
    },
    hide: function() {
      return jq;
    },
    fadeIn: function() {
      return jq;
    },
    fadeOut: function() {
      return jq;
    },
    click: function() {
      return jq;
    },
    bind: function() {
      return jq;
    },
    parent: function() {
      return jq;
    },
    parents: function() {
      return jq;
    },
    children: function() {
      return jq;
    },
    siblings: function() {
      return jq;
    },
    eq: function() {
      return jq;
    },
    first: function() {
      return jq;
    },
    last: function() {
      return jq;
    },
    closest: function() {
      return jq;
    },
    trigger: function() {
      return jq;
    },
    width: function() {
      return 1920;
    },
    height: function() {
      return 1080;
    },
    scrollTop: function() {
      return 0;
    }
  };
  return jq;
}
function createjQuery() {
  var jqResult = createJqResult();
  var jqFn = function(arg) {
    return jqResult;
  };
  jqFn.ajax = function() {
    return { done: function() {
      return this;
    }, fail: function() {
      return this;
    }, always: function() {
      return this;
    } };
  };
  jqFn.get = jqFn.ajax;
  jqFn.post = jqFn.ajax;
  jqFn.getJSON = jqFn.ajax;
  jqFn.fn = {};
  jqFn.extend = function() {
  };
  return jqFn;
}
var capturedConfig = null;
function createPlayerProxy() {
  var p = {
    setup: function(config) {
      capturedConfig = config;
      return p;
    },
    on: function() {
      return p;
    },
    onReady: function() {
      return p;
    },
    onError: function() {
      return p;
    },
    addButton: function() {
      return p;
    },
    getConfig: function() {
      return capturedConfig || {};
    },
    getPlaylist: function() {
      return [];
    },
    getPosition: function() {
      return 0;
    },
    getDuration: function() {
      return 0;
    },
    getState: function() {
      return "idle";
    },
    play: function() {
      return p;
    },
    pause: function() {
      return p;
    },
    seek: function() {
      return p;
    },
    stop: function() {
      return p;
    },
    remove: function() {
      return p;
    },
    resize: function() {
      return p;
    },
    setVolume: function() {
      return p;
    },
    setMute: function() {
      return p;
    },
    setFullscreen: function() {
      return p;
    },
    setCaptions: function() {
      return p;
    },
    setCurrentQuality: function() {
      return p;
    },
    getQualityLevels: function() {
      return [];
    },
    getCurrentQuality: function() {
      return 0;
    },
    trigger: function() {
      return p;
    }
  };
  return p;
}
function extractStreams(playerUrl) {
  return __async(this, null, function* () {
    var html = yield fetchFaselPage(playerUrl);
    if (!html)
      return null;
    var $ = import_cheerio_without_node_native.default.load(html);
    var mainScript = null;
    $("script").each(function() {
      var text = $(this).html() || "";
      if (!$(this).attr("src") && text.length > 2e4 && text.indexOf("jwplayer") > -1) {
        mainScript = text;
      }
    });
    if (!mainScript) {
      var directMatch = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
      if (directMatch)
        return { url: directMatch[0], title: "FaselHD" };
      console.log("[FaselHD] No player script found");
      return null;
    }
    console.log("[FaselHD] Player script: " + mainScript.length + " chars");
    capturedConfig = null;
    var mockJwplayer = function() {
      return createPlayerProxy();
    };
    mockJwplayer.key = null;
    mockJwplayer.version = "8.33.2";
    var mockjQuery = createjQuery();
    var parsedUrl;
    try {
      parsedUrl = new URL(playerUrl);
    } catch (e) {
      parsedUrl = { hostname: "", host: "", origin: "", protocol: "https:", pathname: "", search: "", hash: "" };
    }
    var sandbox = {
      console: { log: function() {
      }, error: function() {
      }, warn: function() {
      }, info: function() {
      }, debug: function() {
      }, trace: function() {
      }, dir: function() {
      }, table: function() {
      } },
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      undefined: void 0,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
      JSON,
      Math,
      Date,
      RegExp,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Error,
      TypeError,
      RangeError,
      Map,
      Set,
      Promise,
      Symbol,
      Infinity: Infinity,
      NaN: NaN,
      setTimeout: function() {
        return 0;
      },
      clearTimeout: function() {
      },
      setInterval: function() {
        return 0;
      },
      clearInterval: function() {
      },
      atob: myAtob,
      btoa: myBtoa,
      document: {
        getElementById: function() {
          return createMockElement();
        },
        querySelector: function() {
          return createMockElement();
        },
        querySelectorAll: function() {
          return [];
        },
        createElement: function(tag) {
          var e = createMockElement();
          e.tagName = (tag || "DIV").toUpperCase();
          return e;
        },
        createTextNode: function() {
          return createMockElement();
        },
        createDocumentFragment: function() {
          return createMockElement();
        },
        createComment: function() {
          return createMockElement();
        },
        body: createMockElement(),
        head: createMockElement(),
        cookie: "",
        addEventListener: function() {
        },
        removeEventListener: function() {
        },
        documentElement: { style: {} },
        readyState: "complete",
        currentScript: { dataset: {} },
        getElementsByTagName: function() {
          return [];
        },
        getElementsByClassName: function() {
          return [];
        },
        getElementsByName: function() {
          return [];
        },
        title: "",
        domain: parsedUrl.hostname,
        hasFocus: function() {
          return true;
        },
        hidden: false,
        visibilityState: "visible"
      },
      localStorage: { getItem: function() {
        return "1";
      }, setItem: function() {
      }, removeItem: function() {
      }, clear: function() {
      } },
      sessionStorage: { getItem: function() {
        return null;
      }, setItem: function() {
      }, removeItem: function() {
      }, clear: function() {
      } },
      navigator: { userAgent: UA, platform: "Win32", language: "en-US", languages: ["en-US"], cookieEnabled: true, onLine: true },
      location: { href: playerUrl, hostname: parsedUrl.hostname, host: parsedUrl.host, origin: parsedUrl.origin, protocol: "https:", pathname: parsedUrl.pathname, search: parsedUrl.search, hash: "" },
      history: { pushState: function() {
      }, replaceState: function() {
      }, back: function() {
      }, forward: function() {
      }, go: function() {
      }, length: 1 },
      performance: { now: function() {
        return Date.now();
      } },
      XMLHttpRequest: function() {
        this.open = function() {
        };
        this.send = function() {
        };
        this.setRequestHeader = function() {
        };
        this.addEventListener = function() {
        };
      },
      fetch: function() {
        return Promise.resolve({ ok: true, json: function() {
          return Promise.resolve({});
        }, text: function() {
          return Promise.resolve("");
        }, headers: { get: function() {
          return null;
        } } });
      },
      Cookies: { get: function() {
        return null;
      }, set: function() {
      } },
      jQuery: mockjQuery,
      $: mockjQuery,
      jwplayer: mockJwplayer,
      Image: function() {
        this.src = "";
      },
      MutationObserver: function() {
        this.observe = function() {
        };
        this.disconnect = function() {
        };
      },
      Event: function(t) {
        this.type = t;
        this.preventDefault = function() {
        };
        this.stopPropagation = function() {
        };
      },
      requestAnimationFrame: function() {
        return 0;
      },
      cancelAnimationFrame: function() {
      },
      alert: function() {
      },
      confirm: function() {
        return false;
      },
      prompt: function() {
        return null;
      },
      open: function() {
        return null;
      },
      close: function() {
      },
      postMessage: function() {
      },
      addEventListener: function() {
      },
      removeEventListener: function() {
      },
      dispatchEvent: function() {
        return true;
      },
      getComputedStyle: function() {
        return {};
      },
      matchMedia: function() {
        return { matches: false, addListener: function() {
        }, removeListener: function() {
        }, addEventListener: function() {
        }, removeEventListener: function() {
        } };
      },
      innerWidth: 1920,
      innerHeight: 1080,
      screen: { width: 1920, height: 1080 },
      devicePixelRatio: 1,
      process: { env: {}, exit: function() {
      }, on: function() {
      }, version: "" }
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.top = sandbox;
    sandbox.parent = sandbox;
    sandbox.globalThis = sandbox;
    var useVm = false;
    try {
      var vm = require("vm");
      if (vm && vm.createContext && vm.runInContext)
        useVm = true;
    } catch (e) {
    }
    if (useVm) {
      try {
        var ctx = vm.createContext(sandbox);
        vm.runInContext(mainScript, ctx, { timeout: 1e4 });
      } catch (e) {
        console.log("[FaselHD] VM error: " + e.message);
      }
    } else {
      var _g = typeof globalThis !== "undefined" ? globalThis : {};
      var _saved = {};
      var _keys = Object.keys(sandbox);
      for (var ki = 0; ki < _keys.length; ki++) {
        var _k = _keys[ki];
        try {
          var _desc = Object.getOwnPropertyDescriptor(_g, _k);
          _saved[_k] = { desc: _desc };
          Object.defineProperty(_g, _k, { value: sandbox[_k], writable: true, configurable: true, enumerable: true });
        } catch (e) {
        }
      }
      try {
        var wrapper = new Function(mainScript);
        wrapper.call(sandbox);
      } catch (e) {
        console.log("[FaselHD] Sandbox error: " + e.message);
      }
      for (var ri = 0; ri < _keys.length; ri++) {
        var _rk = _keys[ri];
        if (!_saved[_rk])
          continue;
        try {
          if (_saved[_rk].desc)
            Object.defineProperty(_g, _rk, _saved[_rk].desc);
          else
            delete _g[_rk];
        } catch (e) {
        }
      }
    }
    yield new Promise(function(r) {
      setTimeout(r, 100);
    });
    if (capturedConfig) {
      var streamUrl = null;
      if (capturedConfig.sources && capturedConfig.sources.length > 0) {
        streamUrl = capturedConfig.sources[0].file;
      } else if (capturedConfig.file) {
        streamUrl = capturedConfig.file;
      }
      if (streamUrl) {
        console.log("[FaselHD] Stream: " + streamUrl.substring(0, 80));
        return { url: streamUrl, title: "FaselHD" };
      }
    }
    var m3u8Match = mainScript.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (m3u8Match) {
      console.log("[FaselHD] Regex fallback found m3u8");
      return { url: m3u8Match[0], title: "FaselHD" };
    }
    console.log("[FaselHD] Could not extract stream");
    return null;
  });
}

// src/faselhdx/tmdb.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_API_BASE = "https://api.themoviedb.org/3";
function getTmdbMeta(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var type = mediaType === "movie" ? "movie" : "tv";
    var url = TMDB_API_BASE + "/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=en-US&append_to_response=external_ids";
    try {
      var resp = yield fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" }
      });
      if (!resp.ok)
        return null;
      var data = yield resp.json();
      var title = data.title || data.name || "";
      var origTitle = data.original_title || data.original_name || "";
      var year = "";
      if (data.release_date)
        year = data.release_date.split("-")[0];
      else if (data.first_air_date)
        year = data.first_air_date.split("-")[0];
      var imdbId = "";
      if (data.external_ids && data.external_ids.imdb_id)
        imdbId = data.external_ids.imdb_id;
      else if (data.imdb_id)
        imdbId = data.imdb_id;
      return { title, originalTitle: origTitle, year, imdbId };
    } catch (e) {
      console.log("[FaselHD] TMDB error: " + e.message);
      return null;
    }
  });
}

// src/faselhdx/scraper.js
var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));
function parseSearchResults(html) {
  var $ = import_cheerio_without_node_native2.default.load(html);
  var results = [];
  var seen = {};
  $("a[href]").each(function() {
    var href = $(this).attr("href") || "";
    if (href && (href.indexOf("/movies/") > -1 || href.indexOf("/seasons/") > -1 || href.indexOf("/series/") > -1 || href.indexOf("/anime/") > -1)) {
      var clean = href.split("?")[0].split("#")[0];
      if (seen[clean])
        return;
      seen[clean] = true;
      var title = $(this).text().trim() || $(this).attr("title") || "";
      results.push({ url: clean, title });
    }
  });
  return results;
}
function searchFaselHD(query, year, type) {
  return __async(this, null, function* () {
    var domain = yield getDomain();
    var searchUrl = domain + "/?s=" + encodeURIComponent(query);
    console.log("[FaselHD] Search: " + searchUrl);
    var html = yield fetchFaselPage(searchUrl);
    if (!html)
      return [];
    var results = parseSearchResults(html);
    if (results.length > 0) {
      if (type === "movie") {
        var f = results.filter(function(r) {
          return r.url.indexOf("/movies/") > -1;
        });
        if (f.length)
          results = f;
      } else if (type === "series" || type === "tv") {
        var f2 = results.filter(function(r) {
          return r.url.indexOf("/seasons/") > -1 || r.url.indexOf("/series/") > -1 || r.url.indexOf("/anime/") > -1;
        });
        if (f2.length)
          results = f2;
      }
    }
    console.log('[FaselHD] "' + query + '" \u2192 ' + results.length + " result(s)");
    return results;
  });
}
var arabicOrdinals = {
  "\u0627\u0644\u0623\u0648\u0644": 1,
  "\u0627\u0644\u0627\u0648\u0644": 1,
  "\u0627\u0644\u062B\u0627\u0646\u064A": 2,
  "\u0627\u0644\u062B\u0627\u0646\u0649": 2,
  "\u0627\u0644\u062B\u0627\u0644\u062B": 3,
  "\u0627\u0644\u0631\u0627\u0628\u0639": 4,
  "\u0627\u0644\u062E\u0627\u0645\u0633": 5,
  "\u0627\u0644\u0633\u0627\u062F\u0633": 6,
  "\u0627\u0644\u0633\u0627\u0628\u0639": 7,
  "\u0627\u0644\u062B\u0627\u0645\u0646": 8,
  "\u0627\u0644\u062A\u0627\u0633\u0639": 9,
  "\u0627\u0644\u0639\u0627\u0634\u0631": 10
};
function extractSeasonNum(text) {
  var decoded;
  try {
    decoded = decodeURIComponent(text);
  } catch (e) {
    decoded = text;
  }
  var keys = Object.keys(arabicOrdinals);
  for (var i = 0; i < keys.length; i++) {
    if (decoded.indexOf(keys[i]) > -1)
      return arabicOrdinals[keys[i]];
  }
  var mDigit = decoded.match(/(?:الموسم|الجزء|season)\s*(\d+)/i) || decoded.match(/\bS0?(\d+)\b/i);
  if (mDigit)
    return parseInt(mDigit[1]);
  return 0;
}
function pickSeasonResult(results, seasonNum) {
  var scored = [];
  for (var i = 0; i < results.length; i++) {
    var combined = results[i].title + " " + results[i].url;
    var num = extractSeasonNum(combined);
    if (num > 0)
      scored.push({ result: results[i], seasonNum: num });
  }
  for (var j = 0; j < scored.length; j++) {
    if (scored[j].seasonNum === seasonNum)
      return scored[j].result;
  }
  return null;
}
function parseSeriesPage(url) {
  return __async(this, null, function* () {
    var html = yield fetchFaselPage(url);
    if (!html)
      return { seasons: [], episodes: [] };
    var $ = import_cheerio_without_node_native2.default.load(html);
    var domain;
    try {
      domain = url.match(/https?:\/\/[^/]+/)[0];
    } catch (e) {
      domain = "";
    }
    var seasons = [];
    $(".seasonDiv").each(function() {
      var title = $(this).find(".title").text().trim();
      var onclick = $(this).attr("onclick") || "";
      var numMatch = title.match(/(\d+)/);
      var sn = numMatch ? parseInt(numMatch[1]) : 0;
      var urlMatch = onclick.match(/['"]([^'"]+)['"]/);
      var seasonUrl = "";
      if (urlMatch) {
        seasonUrl = urlMatch[1].indexOf("http") === 0 ? urlMatch[1] : domain + urlMatch[1];
      }
      if (seasonUrl)
        seasons.push({ num: sn, url: seasonUrl, title });
    });
    var episodes = [];
    var epSeen = {};
    var epLinks = $(".epAll a[href]").length ? $(".epAll a[href]") : $('a[href*="episode"]');
    epLinks.each(function() {
      var href = $(this).attr("href") || "";
      var text = $(this).text().trim();
      if ((href.indexOf("episode") > -1 || href.indexOf("%d8%a7%d9%84%d8%ad%d9%84%d9%82%d8%a9") > -1) && !epSeen[href]) {
        epSeen[href] = true;
        var full = href.indexOf("http") === 0 ? href : domain + href;
        var numM = text.match(/(\d+)/) || href.match(/-(\d+)(?:[-%]|$)/);
        var epNum = numM ? parseInt(numM[1]) : 0;
        episodes.push({ url: full, title: text, num: epNum });
      }
    });
    return { seasons, episodes };
  });
}
function getPlayerTokens(url) {
  return __async(this, null, function* () {
    var html = yield fetchFaselPage(url);
    if (!html)
      return [];
    var $ = import_cheerio_without_node_native2.default.load(html);
    var tokens = [];
    var seen = {};
    var qualityBadge = $(".quality").first().text().trim() || "";
    qualityBadge = qualityBadge.replace(/<[^>]*>/g, "").replace(/"[^"]*"/g, "").trim();
    var serverNum = 0;
    $("iframe").each(function() {
      var src = $(this).attr("data-src") || $(this).attr("src") || "";
      var m = src.match(/player_token=([^"'&\s]+)/);
      if (m && !seen[m[1]]) {
        seen[m[1]] = true;
        serverNum++;
        tokens.push({
          url: src.indexOf("//") === 0 ? "https:" + src : src,
          name: "Server #" + String(serverNum).padStart(2, "0"),
          quality: qualityBadge
        });
      }
    });
    $('[onclick*="player_token"]').each(function() {
      var onclick = $(this).attr("onclick") || "";
      var m = onclick.match(/player_token=([^"'&\s]+)/);
      if (m && !seen[m[1]]) {
        seen[m[1]] = true;
        serverNum++;
        var dom;
        try {
          dom = url.match(/https?:\/\/[^/]+/)[0];
        } catch (e) {
          dom = "";
        }
        tokens.push({
          url: dom + "/video_player?player_token=" + m[1],
          name: $(this).text().trim() || "Server #" + String(serverNum).padStart(2, "0"),
          quality: qualityBadge
        });
      }
    });
    var rawHtml = $.html();
    var regex = /https?:\/\/[^"'\s]+player_token=[^"'\s&]+/g;
    var rm;
    while ((rm = regex.exec(rawHtml)) !== null) {
      var tkm = rm[0].match(/player_token=([^"'&\s]+)/);
      if (tkm && !seen[tkm[1]]) {
        seen[tkm[1]] = true;
        serverNum++;
        tokens.push({
          url: rm[0],
          name: "Server #" + String(serverNum).padStart(2, "0"),
          quality: qualityBadge
        });
      }
    }
    console.log("[FaselHD] " + tokens.length + " player(s)");
    return tokens;
  });
}
function parseMasterPlaylist(masterUrl) {
  return __async(this, null, function* () {
    try {
      var resp = yield safeFetch(masterUrl, {
        headers: { "User-Agent": UA },
        timeout: 15e3
      });
      if (!resp.ok)
        return null;
      var body = yield resp.text();
      if (body.indexOf("#EXTM3U") < 0 || body.indexOf("#EXT-X-STREAM-INF") < 0)
        return null;
      var lines = body.split("\n");
      var variants = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("#EXT-X-STREAM-INF:") !== 0)
          continue;
        var resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
        var bwMatch = line.match(/BANDWIDTH=(\d+)/);
        var url = "";
        for (var j = i + 1; j < lines.length; j++) {
          var next = lines[j].trim();
          if (next && next.charAt(0) !== "#") {
            url = next;
            break;
          }
        }
        if (!url)
          continue;
        if (url.indexOf("http") !== 0) {
          var base = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
          url = base + url;
        }
        var width = resMatch ? parseInt(resMatch[1]) : 0;
        var height = resMatch ? parseInt(resMatch[2]) : 0;
        var bandwidth = bwMatch ? parseInt(bwMatch[1]) : 0;
        var urlQMatch = url.match(/(?:hd|sd)(\d{3,4})/i);
        var label = "";
        if (urlQMatch)
          label = urlQMatch[1] + "p";
        else if (width >= 1920)
          label = "1080p";
        else if (width >= 1280)
          label = "720p";
        else if (width >= 854)
          label = "480p";
        else if (width >= 640)
          label = "360p";
        else if (height)
          label = height + "p";
        variants.push({ url, width, height, bandwidth, label });
      }
      variants.sort(function(a, b) {
        return b.bandwidth - a.bandwidth;
      });
      return variants.length > 0 ? variants : null;
    } catch (e) {
      console.log("[FaselHD] parseMaster error: " + e.message);
      return null;
    }
  });
}

// src/faselhdx/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[FaselHD] Request: " + mediaType + " " + tmdbId + (season ? " S" + season + "E" + episode : ""));
      var meta = yield getTmdbMeta(tmdbId, mediaType);
      if (!meta || !meta.title) {
        console.log("[FaselHD] Could not get TMDB meta for " + tmdbId);
        return [];
      }
      console.log("[FaselHD] Title: " + meta.title + " (" + meta.year + ")");
      yield getDomain();
      var type = mediaType === "movie" ? "movie" : "series";
      var queries = [meta.title];
      var cleaned = meta.title.replace(/[''`:;,!?]/g, "").replace(/\s+/g, " ").trim();
      if (cleaned !== meta.title)
        queries.push(cleaned);
      var parts = meta.title.split(/[:\-–—]\s*/);
      if (parts.length > 1) {
        queries.push(parts[parts.length - 1].trim());
        queries.push(parts[0].trim());
      }
      if (meta.originalTitle && meta.originalTitle !== meta.title) {
        queries.push(meta.originalTitle);
      }
      var results = [];
      for (var qi = 0; qi < queries.length; qi++) {
        results = yield searchFaselHD(queries[qi], meta.year, type);
        if (results.length > 0)
          break;
        if (meta.year) {
          results = yield searchFaselHD(queries[qi] + " " + meta.year, meta.year, type);
          if (results.length > 0)
            break;
        }
      }
      if (results.length === 0) {
        console.log("[FaselHD] Nothing found");
        return [];
      }
      var targetUrl = results[0].url;
      if (type === "series" && season && episode) {
        var sn = parseInt(season);
        var ep = parseInt(episode);
        if (results.length > 1) {
          var seasonResult = pickSeasonResult(results, sn);
          if (seasonResult) {
            console.log("[FaselHD] Matched season " + sn + " from search results");
            targetUrl = seasonResult.url;
          }
        }
        var seriesData = yield parseSeriesPage(targetUrl);
        var episodes = seriesData.episodes;
        if (seriesData.seasons.length > 0 && episodes.length === 0) {
          for (var si = 0; si < seriesData.seasons.length; si++) {
            if (seriesData.seasons[si].num === sn) {
              console.log("[FaselHD] Season " + sn + ": " + seriesData.seasons[si].url);
              var seasonPage = yield parseSeriesPage(seriesData.seasons[si].url);
              episodes = seasonPage.episodes;
              break;
            }
          }
        } else if (seriesData.seasons.length > 1) {
          for (var si2 = 0; si2 < seriesData.seasons.length; si2++) {
            if (seriesData.seasons[si2].num === sn && seriesData.seasons[si2].url !== targetUrl) {
              var sp = yield parseSeriesPage(seriesData.seasons[si2].url);
              if (sp.episodes.length > 0)
                episodes = sp.episodes;
              break;
            }
          }
        }
        var epUrl = null;
        for (var ei = 0; ei < episodes.length; ei++) {
          if (episodes[ei].num === ep) {
            epUrl = episodes[ei].url;
            break;
          }
        }
        if (!epUrl && episodes.length >= ep) {
          epUrl = episodes[ep - 1] ? episodes[ep - 1].url : null;
        }
        if (epUrl) {
          console.log("[FaselHD] Episode " + ep + ": " + epUrl);
          targetUrl = epUrl;
        } else {
          console.log("[FaselHD] Episode " + ep + " not found (" + episodes.length + " available)");
        }
      }
      var players = yield getPlayerTokens(targetUrl);
      if (players.length === 0) {
        console.log("[FaselHD] No players found");
        return [];
      }
      var streams = [];
      for (var pi = 0; pi < players.length; pi++) {
        var p = players[pi];
        var s = yield extractStreams(p.url);
        if (!s)
          continue;
        var variants = yield parseMasterPlaylist(s.url);
        if (variants && variants.length > 1) {
          for (var vi = 0; vi < variants.length; vi++) {
            var v = variants[vi];
            streams.push({
              name: "FaselHD",
              title: (v.label || "auto") + " | " + (p.quality || "") + " | " + p.name,
              url: v.url,
              quality: v.label || "auto",
              headers: { "User-Agent": UA, "Referer": p.url }
            });
          }
        } else {
          streams.push({
            name: "FaselHD",
            title: (p.quality || "auto") + " | " + p.name,
            url: s.url,
            quality: p.quality || "auto",
            headers: { "User-Agent": UA, "Referer": p.url }
          });
        }
      }
      console.log("[FaselHD] " + streams.length + " stream(s)");
      return streams;
    } catch (error) {
      console.error("[FaselHD] Error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
