"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */
function padStart(data, size, fill) {
    return fill
        .repeat(Math.ceil(size / fill.length))
        .slice(0, size - data.length)
        + data;
}
/** `YEAR-0M-0D` */
function localDateStr(date) {
    return date.getFullYear().toString()
        + "-" + padStart((date.getMonth() + 1).toString(), 2, '0')
        + "-" + padStart(date.getDate().toString(), 2, '0');
}
/** `0h:0m:0s` */
function localTimeStr(date) {
    return padStart(date.getHours().toString(), 2, '0')
        + ":" + padStart(date.getMinutes().toString(), 2, '0')
        + ":" + padStart(date.getSeconds().toString(), 2, '0');
}
/** Take a string in the form `"/Hello/i"` and create a new `RegExp`. */
function createRegExpFromString(literal) {
    const lastSlash = literal.lastIndexOf("/");
    const re = new RegExp(literal.slice(1, lastSlash), literal.slice(lastSlash + 1));
    return re;
}
function createRegExpShader(re) {
    const fn = (input) => {
        const out = [];
        let match;
        re.lastIndex = 0;
        if (re.global) {
            while ((match = re.exec(input)) != null)
                out.push(match);
        }
        else {
            if ((match = re.exec(input)) != null)
                out.push(match);
        }
        return out;
    };
    return fn;
}
/** Given an array of `[RegExp, RegExp_replacerString]` pairs,
 * returns a function that transforms a string input by applying the 'rules' in the array in order. */
function createRegExpReplacer(replacerRules) {
    const fn = (input) => {
        let out = input;
        // may need to duplicate replacerRules to prevent mutation
        // ^^ this is not needed at the moment as inputs to buildReplacer map(), which duplicates
        for (const [re, str] of replacerRules) {
            out = out.replace(re, str);
        }
        return out;
    };
    return fn;
}
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */
/** A wrapper to represent namespaced keys in a `Storage` instance (typically either `localStorage` or `cacheStorage`). */
class NamespacedStorage {
    /** A wrapper to represent namespaced keys in a `Storage` instance (typically either `localStorage` or `cacheStorage`).
     * + `store` is the `Storage` instance to apply namespacing to.
     * + `namespace` represents the `prefix::` applied to create the appearance of namespaces. */
    constructor(store, namespace) {
        this.store = store;
        this.namespace = namespace;
    }
    /** Set a `namespace::key` to `value`. */
    set(key, value) {
        this.store.setItem(`${this.namespace}::${key}`, value);
    }
    /** Set a `namespace::key` to `value`, only if it doesn't already exist (think defaults).
     * Returns true if the value was missing, and thus set. */
    setIfNull(key, value) {
        if (this.get(key) == null) {
            this.set(key, value);
            return true;
        }
        else {
            return false;
        }
    }
    /** Get the value of `namespace::key`. */
    get(key) {
        return this.store.getItem(`${this.namespace}::${key}`);
    }
    /** Delete the entry for `namespace::key`. */
    delete(key) {
        this.store.removeItem(key);
    }
    /** Flush all `namespace::*` entries. */
    clear() {
        const keys = [];
        const storeSize = this.store.length;
        for (let i = 0; i < storeSize; ++i) {
            const k = this.store.key(i);
            if (k.startsWith(`${this.namespace}::`)) {
                keys.push(k);
            }
        }
        for (const k of keys) {
            this.store.removeItem(k);
        }
    }
}
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */
function createHTMLElement(opt) {
    const ele = document.createElement(opt.tag);
    ele.id = opt.id;
    ele.classList.add(...opt.class);
    const attrKeys = Object.keys(opt.attr);
    for (const attrKey of attrKeys) {
        ele.setAttribute(attrKey, opt.attr[attrKey]);
    }
    return ele;
}
// need a way to test for 'tainted' html strings
// to block disallowed tags / encode at top level or inside tag
var ViewScript;
(function (ViewScript) {
    // state is a mutable object that can be refered to for the duration of execute()
    // Node is likely either HTMLElement or Text, maybe i should be more specific in the type annotations
    class Runtime {
        constructor(funcs) {
            this.funcs = funcs;
        }
        evalSourceCodePiece(state, piece) {
            var _a;
            let node;
            if (typeof piece != "object" || piece == null) {
                node = document.createTextNode((piece !== null && piece !== void 0 ? piece : "null").toString());
            }
            else {
                const fnId = piece[0];
                const fn = this.funcs[fnId];
                node = (_a = fn === null || fn === void 0 ? void 0 : fn(state, piece.slice(1)
                    .map(v => this.evalSourceCodePiece(state, v)))) !== null && _a !== void 0 ? _a : document.createTextNode("");
            }
            return node;
        }
        execute(state, program) {
            const outputNodes = [];
            for (const piece of program) {
                const result = this.evalSourceCodePiece(state, piece);
                outputNodes.push(result);
            }
            return outputNodes;
        }
    }
    ViewScript.Runtime = Runtime;
})(ViewScript || (ViewScript = {}));
// /** Text that has been safely HTML encoded. */
// type HTMLEncodedString = string & { __TYPE__: "HTMLEncodedString" };
// function encodeHTML(text: string): HTMLEncodedString {
//   text = text.replace(/&/g, "&amp;");
//   text = text.replace(/</g, "&lt;");
//   text = text.replace(/>/g, "&gt;");
//   text = text.replace(/"/g, "&quot;");
//   text = text.replace(/'/g, "&apos;");
//   return Object.assign(text, { __TYPE__: "HTMLEncodedString" as const });
// }
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/** A global namespace creating an API like interface into the internals of the app. */
var TTV;
(function (TTV) {
    /** Global configuration for TimetableView */
    TTV.config = new NamespacedStorage(localStorage, "timetable_view");
    // Set config defaults
    TTV.config.setIfNull("cors_url", "https://api.allorigins.win/raw?url=%s");
    /** Stores the parameters used to load the current view. */
    TTV.loaded = {};
    /** Ready when `DOMContentLoaded` */
    TTV.elements = {};
    window.addEventListener("DOMContentLoaded", () => {
        TTV.elements.eventsOList = document.getElementById("events");
        TTV.elements.eventsDateInput = document.getElementById("events-date");
        TTV.elements.icalUrlInput = document.getElementById("ical-url");
        TTV.elements.icalLoadButton = document.getElementById("ical-load");
        TTV.elements.viewTitleHeading = document.getElementById("view-title");
        TTV.elements.viewCssLink = document.getElementById("view-css");
        TTV.elements.ttvResetButton = document.getElementById("ttv-reset");
        TTV.elements.ttvViewInput = document.getElementById("ttv-view");
        TTV.elements.ttvPrevButton = document.getElementById("ttv-prev");
        TTV.elements.ttvNextButton = document.getElementById("ttv-next");
        TTV.elements.ttvEventsHeading = document.getElementById("ttv-events-heading");
    });
    // article maybe https://stackoverflow.com/questions/9852312/list-of-html5-elements-that-can-be-nested-inside-p-element
    // useful https://learn-the-web.algonquindesign.ca/topics/html-semantics-cheat-sheet/
    // split up
    // 
    // export async function createEventsList(): HTMLLIElement[] {
    // }
    /** Must only be called after `DOMContentLoaded` event */
    function updateCalendarView(opt) {
        return __awaiter(this, void 0, void 0, function* () {
            let events;
            let viewJson;
            let view;
            // we've forced a refresh or the icalHref is 'new' (not currently loaded)
            if (opt.refresh
                || opt.icalHref != TTV.config.get("ical_href")
                || TTV.config.get("ical_href") == null
                || TTV.config.get("jcal_data") == null) {
                TTV.config.set("ical_href", opt.icalHref);
                const icalCorsUrl = TTV.config.get("cors_url").replace("%s", encodeURIComponent(opt.icalHref));
                const icalResponse = yield fetch(icalCorsUrl, { cache: "reload" });
                // if (icalResponse.ok) ...
                // we assume that ical/json data in this if-block is valid and does not throw
                const icalData = yield icalResponse.text();
                // parse and store jcal parsed version of our calendar
                // May throw ICAL.parse.ParserError
                const jcalJson = ICAL.parse(icalData);
                TTV.config.set("jcal_data", JSON.stringify(jcalJson));
                events = parseJcal(jcalJson);
            }
            else {
                events = parseJcal(JSON.parse(TTV.config.get("jcal_data")));
            }
            if (opt.refresh
                || opt.viewId != TTV.config.get("view_id")
                || TTV.config.get("view_id") == null
                || TTV.config.get("view_data") == null) {
                // might be better off fetching normally/typically/standard-way like browser does for css
                const viewData = yield (yield fetch(`./views/${opt.viewId}.json`, { cache: "reload" })).text();
                TTV.config.set("view_id", opt.viewId);
                TTV.config.set("view_data", viewData);
                viewJson = JSON.parse(viewData);
                view = buildEventsView(viewJson);
            }
            else {
                viewJson = JSON.parse(TTV.config.get("view_data"));
                view = buildEventsView(viewJson);
            }
            events.sort((first, second) => first.startDate.compare(second.startDate));
            TTV.elements.eventsOList.innerHTML = "";
            TTV.elements.viewTitleHeading.textContent = view.title;
            TTV.elements.viewCssLink.href = `./views/${opt.viewId}.css`;
            const dateStr = localDateStr(opt.forDate);
            TTV.elements.ttvEventsHeading.innerHTML = "Events - <time datetime='" + dateStr + "'>" + dateStr.split("-").reverse().map(Number).join("/") + "</time>";
            const nowMs = ICAL.Time.now().toJSDate().valueOf();
            const icalForDate = ICAL.Time.fromJSDate(opt.forDate);
            for (const event of events) {
                // temporary const will be global ticker value
                if (event.startDate.dayOfYear() <= icalForDate.dayOfYear() && icalForDate.dayOfYear() <= event.endDate.dayOfYear()) {
                    const evItem = document.createElement("li");
                    // temporary consts will be a global ticker
                    const startPos = event.startDate.toJSDate().valueOf();
                    const endPos = event.endDate.toJSDate().valueOf();
                    const duration = endPos - startPos;
                    const nowPos = nowMs - startPos;
                    const evProgress = Math.min(Math.max(nowPos / duration, 0), 1);
                    evItem.style.setProperty("--event-progress", evProgress.toFixed(2));
                    evItem.append(view.buildArticle({ event }));
                    TTV.elements.eventsOList.append(evItem);
                }
            }
            TTV.loaded.events = events;
            TTV.loaded.icalHref = opt.icalHref;
            TTV.loaded.viewId = opt.viewId;
            TTV.loaded.viewJson = viewJson;
            TTV.loaded.view = view;
        });
    }
    TTV.updateCalendarView = updateCalendarView;
    function parseJcal(jcalJson) {
        const calComp = new ICAL.Component(jcalJson);
        const rawEvents = calComp.getAllSubcomponents("vevent");
        const events = rawEvents.map(vevent => new ICAL.Event(vevent));
        // JSON.stringify(rawEvents);
        return events;
    }
    function buildEventsView(viewJson) {
        const title = viewJson["title"] || "Timetable View";
        const variables = viewJson["variables"];
        const replacers = (() => {
            let replacersObj = {};
            for (const replacerKey in viewJson["replacers"]) {
                replacersObj[replacerKey] = createRegExpReplacer(viewJson["replacers"][replacerKey]
                    .map(([regexStringLiteral, replaceString]) => [
                    createRegExpFromString(regexStringLiteral),
                    replaceString
                ]));
            }
            return replacersObj;
        })();
        const shaders = (() => {
            let shadersObj = {};
            for (const shaderKey in viewJson["shaders"]) {
                const re = createRegExpFromString(viewJson["shaders"][shaderKey]);
                shadersObj[shaderKey] = createRegExpShader(re);
            }
            return shadersObj;
        })();
        // not really necessary at this level, remove for now
        // const shaderCache = new Map<string, RegExpMatchArray[]>();
        const viewsArrayScriptRuntime = new ViewScript.Runtime({
            "shader"(state, args) {
                var _a, _b, _c, _d;
                const inputText = (_a = args[0].textContent) !== null && _a !== void 0 ? _a : "";
                const shaderKey = (_b = args[1].textContent) !== null && _b !== void 0 ? _b : "";
                const matchNum = parseInt((_c = args[2].textContent) !== null && _c !== void 0 ? _c : "") || 0;
                const groupNum = parseInt((_d = args[3].textContent) !== null && _d !== void 0 ? _d : "") || 0;
                let element;
                if (shaderKey in shaders) {
                    const shaderResult = shaders[shaderKey](inputText);
                    element = new Text(shaderResult[matchNum][groupNum]);
                }
                else {
                    element = new Text();
                }
                return element;
            },
            "replace"(state, args) {
                var _a, _b;
                const originalText = (_a = args[0].textContent) !== null && _a !== void 0 ? _a : "";
                const replacerKey = (_b = args[1].textContent) !== null && _b !== void 0 ? _b : "";
                let element;
                if (replacerKey in replacers) {
                    const replacerResult = replacers[replacerKey](originalText);
                    element = new Text(replacerResult);
                }
                else {
                    element = new Text();
                }
                return element;
            },
            "var"(state, args) {
                var _a;
                const varKey = (_a = args[0].textContent) !== null && _a !== void 0 ? _a : "";
                let variableValue;
                if (varKey in variables) {
                    variableValue = variables[varKey];
                }
                else {
                    switch (varKey) {
                        case "_event.description": {
                            variableValue = state.event.description;
                            break;
                        }
                        case "_event.location": {
                            variableValue = state.event.location;
                            break;
                        }
                        case "_event.duration": {
                            const dur = state.event.duration;
                            variableValue = `${dur.weeks}w${dur.days}d${dur.hours}h${dur.minutes}m${dur.seconds}s`;
                            break;
                        }
                        case "_event.start": {
                            const date = state.event.startDate.toJSDate();
                            const year = date.getFullYear().toString();
                            const month = padStart(date.getMonth().toString(), 2, "0");
                            const day = padStart(date.getDate().toString(), 2, "0");
                            const hour = padStart(date.getHours().toString(), 2, "0");
                            const minute = padStart(date.getMinutes().toString(), 2, "0");
                            const second = padStart(date.getSeconds().toString(), 2, "0");
                            variableValue = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
                            break;
                        }
                        case "_event.end": {
                            const date = state.event.endDate.toJSDate();
                            const year = date.getFullYear().toString();
                            const month = padStart(date.getMonth().toString(), 2, "0");
                            const day = padStart(date.getDate().toString(), 2, "0");
                            const hour = padStart(date.getHours().toString(), 2, "0");
                            const minute = padStart(date.getMinutes().toString(), 2, "0");
                            const second = padStart(date.getSeconds().toString(), 2, "0");
                            variableValue = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
                            break;
                        }
                        default: {
                            variableValue = "";
                            break;
                        }
                    }
                }
                return new Text(variableValue);
            },
            "<span>"(state, args) {
                const element = document.createElement("span");
                element.append(args[0]);
                return element;
            },
            "<strong>"(state, args) {
                const element = document.createElement("strong");
                element.append(args[0]);
                return element;
            },
            "<em>"(state, args) {
                const element = document.createElement("em");
                element.append(args[0]);
                return element;
            },
            "<time>"(state, args) {
                var _a;
                const element = document.createElement("time");
                element.append(args[0]);
                element.dateTime = (_a = args[0].textContent) !== null && _a !== void 0 ? _a : "";
                return element;
            },
            "<abbr>"(state, args) {
                const element = document.createElement("abbr");
                element.append(args[0]);
                return element;
            },
            "<b>"(state, args) {
                const element = document.createElement("b");
                element.append(args[0]);
                return element;
            },
            "<i>"(state, args) {
                const element = document.createElement("i");
                element.append(args[0]);
                return element;
            },
        });
        return {
            title, variables, replacers, shaders,
            buildArticle: (state) => {
                const articleEle = document.createElement("article");
                for (const line of viewJson["article"]) {
                    const paragraph = document.createElement("p");
                    paragraph.append(...viewsArrayScriptRuntime.execute(state, line));
                    articleEle.append(paragraph);
                }
                return articleEle;
            }
        };
    }
})(TTV || (TTV = {}));
/* Main */
window.addEventListener("DOMContentLoaded", () => {
    const now = new Date();
    // setup initial values for input elements
    TTV.elements.eventsDateInput.value = localDateStr(now);
    if (TTV.config.get("ical_href") != null) {
        TTV.elements.icalLoadButton.textContent = "Reload Calendar";
    }
    // setup event handlers
    /** Returns true if updated; */
    function checkValidInputsAndUpdate(refresh = false) {
        if (TTV.elements.icalUrlInput.reportValidity()
            && TTV.elements.eventsDateInput.reportValidity()
            && TTV.elements.ttvViewInput.reportValidity()) {
            TTV.updateCalendarView({
                forDate: TTV.elements.eventsDateInput.valueAsDate,
                icalHref: TTV.elements.icalUrlInput.value,
                viewId: TTV.elements.ttvViewInput.value,
                refresh,
            });
            return true;
        }
        else {
            return false;
        }
    }
    TTV.elements.ttvResetButton.addEventListener("click", () => {
        TTV.config.clear();
        window.location.reload();
    });
    TTV.elements.ttvPrevButton.addEventListener("click", () => {
        TTV.elements.eventsDateInput.stepDown();
        checkValidInputsAndUpdate();
    });
    TTV.elements.ttvNextButton.addEventListener("click", () => {
        TTV.elements.eventsDateInput.stepUp();
        checkValidInputsAndUpdate();
    });
    TTV.elements.icalLoadButton.addEventListener("click", () => {
        var refresh;
        if (checkValidInputsAndUpdate(refresh = true)) {
            TTV.elements.icalLoadButton.textContent = "Reload Calendar";
        }
    });
    TTV.elements.eventsDateInput.addEventListener("input", () => {
        checkValidInputsAndUpdate();
    });
    // default presentation handling
    const icalHref = TTV.config.get("ical_href");
    const viewId = TTV.config.get("view_id");
    if (icalHref != null && viewId != null) {
        TTV.elements.icalUrlInput.value = icalHref;
        TTV.elements.ttvViewInput.value = viewId;
        checkValidInputsAndUpdate();
    }
});
window.addEventListener("error", errEv => {
    const reloadConfirmed = confirm("An error occured: " + errEv.error + ".\nWould you like to reset the site?");
    if (reloadConfirmed) {
        TTV.elements.ttvResetButton.click();
    }
});
//# sourceMappingURL=timetable-view.bundle.js.map