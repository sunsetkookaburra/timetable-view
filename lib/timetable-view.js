"use strict";
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
/*  */
function encodeHTML(text) {
    text = text.replace(/&/g, "&amp;");
    text = text.replace(/</g, "&lt;");
    text = text.replace(/>/g, "&gt;");
    text = text.replace(/"/g, "&quot;");
    text = text.replace(/'/g, "&apos;");
    return text;
}
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
// interface Defer<T> extends Promise<T> {
//   resolve(value: T | PromiseLike<T>): void;
//   reject(reason?: any): void;
// }
// function defer<T>(): Defer<T> {
//   const deferObj = {
//     resolve: null as any,
//     reject: null as any,
//   };
//   const promise = new Promise<T>((res, rej)=>{
//     deferObj.resolve = res;
//     deferObj.reject = rej;
//   });
//   return Object.assign(promise, deferObj);
// }
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
                const icalResponse = yield fetch(icalCorsUrl);
                // if (icalResponse.ok) ...
                // we assume that ical/json data in this if-block is valid and does not throw
                const icalData = yield icalResponse.text();
                // parse and store jcal parsed version of our calendar
                // May throw ICAL.parse.ParserError
                const jcalJson = ICAL.parse(icalData);
                TTV.config.set("jcal_data", JSON.stringify(jcalJson));
                events = parseCalendar(jcalJson);
            }
            else {
                events = parseCalendar(JSON.parse(TTV.config.get("jcal_data")));
            }
            if (opt.refresh
                || opt.viewId != TTV.config.get("view_id")
                || TTV.config.get("view_id") == null
                || TTV.config.get("view_data") == null) {
                // might be better off fetching normally/typically/standard-way like browser does for css
                const viewData = yield (yield fetch(`./views/${opt.viewId}.json`)).text();
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
            TTV.elements.ttvEventsHeading.textContent = "Events - " + localDateStr(opt.forDate).split("-").reverse().map(Number).join("/");
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
    function parseCalendar(jcalJson) {
        const calComp = new ICAL.Component(jcalJson);
        const rawEvents = calComp.getAllSubcomponents("vevent");
        const events = rawEvents.map(vevent => new ICAL.Event(vevent));
        // JSON.stringify(rawEvents);
        return events;
    }
    function buildRegExp(literal) {
        const lastSlash = literal.lastIndexOf("/");
        const re = new RegExp(literal.slice(1, lastSlash), literal.slice(lastSlash + 1));
        return re;
    }
    function buildReplacer(replacerJson) {
        const regexAndReplaceStringArr = [];
        for (const regexLiteralKey in replacerJson) {
            regexAndReplaceStringArr.push([
                buildRegExp(regexLiteralKey),
                replacerJson[regexLiteralKey],
            ]);
        }
        const fn = (input) => {
            let out = input;
            for (const [re, str] of regexAndReplaceStringArr) {
                out = out.replace(re, str);
            }
            return out;
        };
        return fn;
    }
    function buildShader(shaderLiteral) {
        const re = buildRegExp(shaderLiteral);
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
    function buildEventsView(viewJson) {
        const title = viewJson["title"] || "Timetable View";
        const variables = viewJson["variables"];
        const replacers = (() => {
            let replacersObj = {};
            for (const replacerKey in viewJson["replacers"]) {
                replacersObj[replacerKey] = buildReplacer(viewJson["replacers"][replacerKey]);
            }
            return replacersObj;
        })();
        const shaders = (() => {
            let shadersObj = {};
            for (const shaderKey in viewJson["shaders"]) {
                shadersObj[shaderKey] = buildShader(viewJson["shaders"][shaderKey]);
            }
            return shadersObj;
        })();
        const compiledShaders = new Map();
        // has capability for advanced recursion of every attribute,
        // currently removed for optimisation (and not seen as necessary yet)
        // also responsible for escaping html chars
        function evalLexeme(state, lexeme) {
            var _a, _b, _c, _d, _e;
            let out;
            if (typeof lexeme == "string") {
                out = encodeHTML(lexeme);
            }
            else if (typeof lexeme == "number") {
                out = encodeHTML(lexeme.toString());
            }
            else {
                switch ( /*fn_name*/lexeme[0]) {
                    case "replace": {
                        const originalText = evalLexeme(state, lexeme[1]);
                        const replacerKey = lexeme[2];
                        out = encodeHTML(replacers[replacerKey](originalText));
                        break;
                    }
                    case "shader": {
                        const inputText = evalLexeme(state, lexeme[1]);
                        const shaderKey = lexeme[2];
                        const matchNum = lexeme[3];
                        const groupNum = lexeme[4];
                        const compiledShaderKey = inputText + "\x00\x7F\x00" + shaderKey;
                        if (compiledShaders.has(compiledShaderKey)) {
                            out = encodeHTML((_c = (_b = (_a = compiledShaders.get(compiledShaderKey)) === null || _a === void 0 ? void 0 : _a[matchNum]) === null || _b === void 0 ? void 0 : _b[groupNum]) !== null && _c !== void 0 ? _c : "");
                        }
                        else {
                            const compilationResult = shaders[shaderKey](inputText);
                            compiledShaders.set(compiledShaderKey, compilationResult);
                            out = encodeHTML((_e = (_d = compilationResult === null || compilationResult === void 0 ? void 0 : compilationResult[matchNum]) === null || _d === void 0 ? void 0 : _d[groupNum]) !== null && _e !== void 0 ? _e : "");
                        }
                        break;
                    }
                    case "var": {
                        const varKey = lexeme[1];
                        switch (varKey) {
                            case "_event.description":
                                out = encodeHTML(state.event.description);
                                break;
                            case "_event.location":
                                out = encodeHTML(state.event.location);
                                break;
                            case "_event.duration":
                                let dur = state.event.duration;
                                out = encodeHTML(`${dur.weeks}w${dur.days}d${dur.hours}h${dur.minutes}m${dur.seconds}s`);
                                break;
                            case "_event.start":
                                let start = state.event.startDate.toJSDate();
                                out = encodeHTML(start.toLocaleString("en-AU"));
                                break;
                            case "_event.end":
                                let end = state.event.endDate.toJSDate();
                                out = encodeHTML(end.toLocaleString("en-AU"));
                            default: {
                                if (variables[varKey] != undefined) {
                                    out = encodeHTML(variables[varKey].toString());
                                }
                                else {
                                    out = "";
                                }
                                break;
                            }
                        }
                        break;
                    }
                    // UNSAFE
                    case "<span>": {
                        const content = evalLexeme(state, lexeme[1]);
                        const classList = lexeme[2];
                        out = `<span class="${encodeHTML(classList)}">${content}</span>`;
                        break;
                    }
                    // UNSAFE
                    case "<strong>": {
                        const content = evalLexeme(state, lexeme[1]);
                        out = `<strong>${content}</strong>`;
                        break;
                    }
                    // UNSAFE
                    case "<em>": {
                        const content = evalLexeme(state, lexeme[1]);
                        out = `<em>${content}</em>`;
                        break;
                    }
                    // UNSAFE
                    case "<i>": {
                        const content = evalLexeme(state, lexeme[1]);
                        out = `<i>${content}</i>`;
                        break;
                    }
                    // UNSAFE
                    case "<b>": {
                        const content = evalLexeme(state, lexeme[1]);
                        out = `<b>${content}</b>`;
                        break;
                    }
                    // UNSAFE
                    case "<time>": {
                        const content = evalLexeme(state, lexeme[1]);
                        out = `<time>${content}</time>`;
                        break;
                    }
                    // UNSAFE
                    case "<abbr>": {
                        const content = evalLexeme(state, lexeme[1]);
                        out = `<time>${content}</time>`;
                        break;
                    }
                    default: {
                        out = encodeHTML("");
                        break;
                    }
                }
            }
            // console.log(`Lexeme<${JSON.stringify(lexeme)}> => ${out}`);
            return out;
        }
        return {
            title, variables, replacers, shaders,
            buildArticle: (state) => {
                const articleEle = document.createElement("article");
                for (const line of viewJson["article"]) {
                    const pEle = document.createElement("p");
                    // console.log("LINE");
                    for (const phrase of line) {
                        // console.log("PHRASE");
                        pEle.insertAdjacentHTML("beforeend", evalLexeme(state, phrase));
                    }
                    articleEle.append(pEle);
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
    TTV.elements.ttvResetButton.addEventListener("click", () => {
        TTV.config.clear();
        window.location.reload();
    });
    TTV.elements.ttvPrevButton.addEventListener("click", () => {
        TTV.elements.eventsDateInput.stepDown();
        if (TTV.elements.icalUrlInput.reportValidity()
            && TTV.elements.eventsDateInput.reportValidity()
            && TTV.elements.ttvViewInput.reportValidity()) {
            TTV.updateCalendarView({
                forDate: TTV.elements.eventsDateInput.valueAsDate,
                icalHref: TTV.elements.icalUrlInput.value,
                viewId: TTV.elements.ttvViewInput.value,
                refresh: false,
            });
        }
    });
    TTV.elements.ttvNextButton.addEventListener("click", () => {
        TTV.elements.eventsDateInput.stepUp();
        if (TTV.elements.icalUrlInput.reportValidity()
            && TTV.elements.eventsDateInput.reportValidity()
            && TTV.elements.ttvViewInput.reportValidity()) {
            TTV.updateCalendarView({
                forDate: TTV.elements.eventsDateInput.valueAsDate,
                icalHref: TTV.elements.icalUrlInput.value,
                viewId: TTV.elements.ttvViewInput.value,
                refresh: false,
            });
        }
    });
    TTV.elements.icalLoadButton.addEventListener("click", () => {
        if (TTV.elements.icalUrlInput.reportValidity()
            && TTV.elements.eventsDateInput.reportValidity()
            && TTV.elements.ttvViewInput.reportValidity()) {
            TTV.elements.icalLoadButton.textContent = "Reload Calendar";
            TTV.updateCalendarView({
                forDate: TTV.elements.eventsDateInput.valueAsDate,
                icalHref: TTV.elements.icalUrlInput.value,
                viewId: TTV.elements.ttvViewInput.value,
                refresh: true,
            });
        }
    });
    TTV.elements.eventsDateInput.addEventListener("input", () => {
        if (TTV.elements.icalUrlInput.reportValidity()
            && TTV.elements.eventsDateInput.reportValidity()
            && TTV.elements.ttvViewInput.reportValidity()) {
            TTV.updateCalendarView({
                forDate: TTV.elements.eventsDateInput.valueAsDate,
                icalHref: TTV.elements.icalUrlInput.value,
                viewId: TTV.elements.ttvViewInput.value,
                refresh: false,
            });
        }
    });
    // default presentation handling
    const icalHref = TTV.config.get("ical_href");
    const viewId = TTV.config.get("view_id");
    if (icalHref != null && viewId != null) {
        TTV.elements.icalUrlInput.value = icalHref;
        TTV.elements.ttvViewInput.value = viewId;
        TTV.updateCalendarView({
            forDate: now,
            icalHref,
            viewId,
            refresh: false,
        });
    }
});
//# sourceMappingURL=timetable-view.js.map