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
// Future Optimsation by loading content parallel
// then wait for DOM at end
/* Setup */
// <script src="lib/ical.min.js"></script>
/* localStorage Keys */
const KEY_ICALHREF = "timetable::ical_href";
const KEY_VIEWID = "timetable::view_id";
/*  */
function encodeHTML(text) {
    text = text.replace(/&/g, "&amp;");
    text = text.replace(/</g, "&lt;");
    text = text.replace(/>/g, "&gt;");
    text = text.replace(/"/g, "&quot;");
    text = text.replace(/'/g, "&apos;");
    return text;
}
function defer() {
    const deferObj = {
        resolve: null,
        reject: null,
    };
    const promise = new Promise((res, rej) => {
        deferObj.resolve = res;
        deferObj.reject = rej;
    });
    return Object.assign(promise, deferObj);
}
var TTV;
(function (TTV) {
    TTV.elements = {
        icalUrlInput: defer(),
        icalLoadButton: defer(),
        eventsOList: defer(),
        viewCssLink: defer(),
        eventsDateInput: defer(),
        ttvResetButton: defer(),
        ttvViewInput: defer(),
        viewTitleHeading: defer(),
    };
    TTV.loaded = {
        events: [],
        icalHref: "",
        viewId: "",
        viewJson: {},
    };
    TTV.config = {
        CORS_URL: "https://api.allorigins.win/raw?url=%s",
    };
    // article maybe https://stackoverflow.com/questions/9852312/list-of-html5-elements-that-can-be-nested-inside-p-element
    // useful https://learn-the-web.algonquindesign.ca/topics/html-semantics-cheat-sheet/
    function updateCalendarView(icalHref, viewId, today = ICAL.Time.now()) {
        return __awaiter(this, void 0, void 0, function* () {
            const [eventsOList, viewCssLink, viewTitleHeading,] = yield Promise.all([
                TTV.elements.eventsOList,
                TTV.elements.viewCssLink,
                TTV.elements.viewTitleHeading,
            ]);
            viewCssLink.href = `./views/${viewId}.css`;
            const corsHref = TTV.config.CORS_URL.replace("%s", encodeURIComponent(icalHref));
            const icalRes = yield fetch(corsHref);
            if (icalRes.ok) {
                const icalData = yield icalRes.text();
                try {
                    // this may throw on invalid icalendar data
                    const calEvents = parseCalendar(icalData);
                    const viewJson = JSON.parse(yield (yield fetch(`./views/${viewId}.json`, { cache: "reload" })).text());
                    TTV.loaded.events = calEvents;
                    TTV.loaded.viewId = viewId;
                    TTV.loaded.viewJson = viewJson;
                    TTV.loaded.icalHref = icalHref;
                    const view = buildEventsView(viewJson);
                    eventsOList.innerHTML = "";
                    viewTitleHeading.textContent = view.title;
                    for (const event of calEvents) {
                        // temporary const will be global ticker value
                        const now = ICAL.Time.now().toJSDate().valueOf();
                        if (event.startDate.dayOfYear() <= today.dayOfYear() && today.dayOfYear() <= event.endDate.dayOfYear()) {
                            const evItem = document.createElement("li");
                            // temporary consts will be a global ticker
                            const startPos = event.startDate.toJSDate().valueOf();
                            const endPos = event.endDate.toJSDate().valueOf();
                            const duration = endPos - startPos;
                            const nowPos = now - startPos;
                            const evProgress = Math.min(Math.max(nowPos / duration, 0), 1);
                            evItem.style.setProperty("--event-progress", evProgress.toFixed(2));
                            evItem.append(view.buildArticle({ event }));
                            eventsOList.append(evItem);
                        }
                    }
                }
                catch (e) {
                    if (e.name == "ParserError") {
                        alert(e);
                    }
                    else {
                        throw e;
                    }
                }
            }
            else {
                alert("failed to load ical file :(");
            }
        });
    }
    TTV.updateCalendarView = updateCalendarView;
    /** Throws `ICAL.parse.ParserError` */
    function parseCalendar(icalData) {
        const jcal = ICAL.parse(icalData);
        const calComp = new ICAL.Component(jcal);
        const events = calComp.getAllSubcomponents("vevent")
            .map(vevent => new ICAL.Event(vevent));
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
                            case "_event::description":
                                out = encodeHTML(state.event.description);
                                break;
                            case "_event::location":
                                out = encodeHTML(state.event.location);
                                break;
                            case "_event::duration":
                                let dur = state.event.duration;
                                out = encodeHTML(`${dur.weeks}w${dur.days}d${dur.hours}h${dur.minutes}m${dur.seconds}s`);
                                break;
                            case "_event::start":
                                let start = state.event.startDate.toJSDate();
                                out = encodeHTML(start.toLocaleString("en-AU"));
                                break;
                            case "_event::end":
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
    TTV.elements.eventsOList.resolve(document.getElementById("events"));
    TTV.elements.icalUrlInput.resolve(document.getElementById("ical-url"));
    TTV.elements.icalLoadButton.resolve(document.getElementById("ical-load"));
    TTV.elements.eventsDateInput.resolve(document.getElementById("events-date"));
    TTV.elements.viewCssLink.resolve(document.getElementById("view-css"));
    TTV.elements.ttvResetButton.resolve(document.getElementById("ttv-reset"));
    TTV.elements.ttvViewInput.resolve(document.getElementById("ttv-view"));
    TTV.elements.viewTitleHeading.resolve(document.getElementById("view-title"));
});
TTV.elements.ttvResetButton.then(ele => {
    ele.addEventListener("click", () => {
        localStorage.removeItem(KEY_ICALHREF);
        localStorage.removeItem(KEY_VIEWID);
        window.location.reload();
    });
});
window.addEventListener("load", () => __awaiter(void 0, void 0, void 0, function* () {
    const [icalLoadButton, icalUrlInput, eventsDateInput, ttvViewInput,] = yield Promise.all([
        TTV.elements.icalLoadButton,
        TTV.elements.icalUrlInput,
        TTV.elements.eventsDateInput,
        TTV.elements.ttvViewInput,
    ]);
    const now = ICAL.Time.now();
    eventsDateInput.valueAsDate = now.toJSDate();
    let icalHref;
    // update icalHref on input into box
    icalUrlInput.addEventListener("input", () => {
        icalHref = icalUrlInput.value;
    });
    // 1. on load button press
    icalLoadButton.addEventListener("click", () => __awaiter(void 0, void 0, void 0, function* () {
        if (icalUrlInput.reportValidity()
            && eventsDateInput.reportValidity()
            && ttvViewInput.reportValidity()) {
            console.log(eventsDateInput.valueAsDate);
            localStorage.setItem(KEY_ICALHREF, icalHref);
            // localStorage.setItem(KEY_VIEWID, icalHref);
            yield TTV.updateCalendarView(icalHref, ttvViewInput.value, ICAL.Time.fromJSDate(eventsDateInput.valueAsDate));
        }
    }));
    // 2. fetch from localstorage on init
    if (localStorage.getItem(KEY_ICALHREF) != null) {
        icalHref = localStorage.getItem(KEY_ICALHREF);
        icalUrlInput.value = icalHref;
        if (icalUrlInput.reportValidity()) {
            localStorage.setItem(KEY_ICALHREF, icalHref);
            yield TTV.updateCalendarView(icalHref, "uts", now);
        }
    }
}));
//# sourceMappingURL=timetable-view.js.map