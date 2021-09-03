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
const KEY_ICALHREF = "timetable::ical_href";
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
    function evalLexeme(state, lexeme) {
        var _a, _b, _c, _d, _e;
        let out;
        if (typeof lexeme == "string") {
            out = lexeme;
        }
        else if (typeof lexeme == "number") {
            out = lexeme.toString();
        }
        else {
            switch ( /*fn_name*/lexeme[0]) {
                case "replace": {
                    const originalText = evalLexeme(state, lexeme[1]);
                    const replacerKey = evalLexeme(state, lexeme[2]);
                    out = replacers[replacerKey](originalText);
                    break;
                }
                case "shader": {
                    const inputText = evalLexeme(state, lexeme[1]);
                    const shaderKey = evalLexeme(state, lexeme[2]);
                    const matchNum = parseInt(evalLexeme(state, lexeme[3])) || 0;
                    const groupNum = parseInt(evalLexeme(state, lexeme[4])) || 0;
                    const compiledShaderKey = inputText + "\x00\x7F\x00" + shaderKey;
                    if (compiledShaders.has(compiledShaderKey)) {
                        out = (_c = (_b = (_a = compiledShaders.get(compiledShaderKey)) === null || _a === void 0 ? void 0 : _a[matchNum]) === null || _b === void 0 ? void 0 : _b[groupNum]) !== null && _c !== void 0 ? _c : "";
                    }
                    else {
                        const compilationResult = shaders[shaderKey](inputText);
                        compiledShaders.set(compiledShaderKey, compilationResult);
                        out = (_e = (_d = compiledShaderKey === null || compiledShaderKey === void 0 ? void 0 : compiledShaderKey[matchNum]) === null || _d === void 0 ? void 0 : _d[groupNum]) !== null && _e !== void 0 ? _e : "";
                    }
                    break;
                }
                case "event": {
                    const eventPropertyKey = evalLexeme(state, lexeme[1]);
                    switch (eventPropertyKey) {
                        case "description":
                            out = state.event.description;
                            break;
                        case "location":
                            out = state.event.location;
                            break;
                        case "duration":
                            let dur = state.event.duration;
                            out = `${dur.weeks}w${dur.days}d${dur.hours}h${dur.minutes}m${dur.seconds}s`;
                            break;
                        case "start":
                            let start = state.event.startDate;
                            out = start.toJSDate().toLocaleString();
                            break;
                        default:
                            out = "";
                            break;
                    }
                    break;
                }
                default: {
                    out = "";
                    break;
                }
            }
        }
        // console.log(`Lexeme<${JSON.stringify(lexeme)}> => ${out}`);
        return out;
    }
    return {
        variables, replacers, shaders,
        buildArticle: (state) => {
            const articleEle = document.createElement("article");
            for (const line of viewJson["article"]) {
                const pEle = document.createElement("p");
                // console.log("LINE");
                for (const phrase of line) {
                    // console.log("PHRASE");
                    pEle.insertAdjacentText("beforeend", evalLexeme(state, phrase));
                }
                articleEle.append(pEle);
            }
            return articleEle;
        }
    };
}
// article maybe https://stackoverflow.com/questions/9852312/list-of-html5-elements-that-can-be-nested-inside-p-element
// useful https://learn-the-web.algonquindesign.ca/topics/html-semantics-cheat-sheet/
function updateCalendarView(icalhref) {
    return __awaiter(this, void 0, void 0, function* () {
        const corsHref = `https://api.allorigins.win/raw?url=${encodeURIComponent(icalhref)}`;
        const icalRes = yield fetch(corsHref);
        if (icalRes.ok) {
            const icalData = yield icalRes.text();
            try {
                // this may throw on invalid icalendar data
                const calEvents = parseCalendar(icalData);
                const viewsJson = JSON.parse(yield (yield fetch("./views.json")).text());
                globalThis["TTV_VIEWS"] = viewsJson;
                globalThis["TTV_EVENTS"] = calEvents;
                const view = buildEventsView(viewsJson["uts"]);
                const evList = document.getElementById("event-list");
                evList.innerHTML = "";
                const now = ICAL.Time.now();
                for (const event of calEvents) {
                    if (event.startDate.dayOfYear() <= now.dayOfYear() && now.dayOfYear() <= event.endDate.dayOfYear()) {
                        const evItem = document.createElement("li");
                        evItem.append(view.buildArticle({ event }));
                        evList.append(evItem);
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
window.onload = () => __awaiter(void 0, void 0, void 0, function* () {
    const icalInputBox = document.getElementById("ical-url");
    const icalLoadButton = document.getElementById("ical-load");
    let icalHref;
    // update icalHref on input into box
    icalInputBox.addEventListener("input", () => {
        icalHref = icalInputBox.value;
    });
    // 1. on load button press
    icalLoadButton.addEventListener("click", () => __awaiter(void 0, void 0, void 0, function* () {
        if (icalInputBox.reportValidity()) {
            localStorage.setItem(KEY_ICALHREF, icalHref);
            yield updateCalendarView(icalHref);
        }
    }));
    // 2. fetch from localstorage on init
    if (localStorage.getItem(KEY_ICALHREF) != null) {
        icalHref = localStorage.getItem(KEY_ICALHREF);
        icalInputBox.value = icalHref;
        icalLoadButton.click();
    }
});
// parse event text / data block
//# sourceMappingURL=timetable-view.js.map