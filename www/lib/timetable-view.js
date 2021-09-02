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
function reFromString(source) {
    const lastSlash = source.lastIndexOf("/");
    return new RegExp(source.slice(1, lastSlash), source.slice(lastSlash + 1));
}
function reShader(re, input) {
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
}
function loadViews(views) {
    for (const viewKey in views) {
        const view = views[viewKey];
        const replacers = view["replace"];
        const shaders = view["event"]["shader"];
        for (const replacerKey in replacers) {
            const replacer = replacers[replacerKey];
            const replacerREs = Object.keys(replacer)
                .map(reKey => {
                return [
                    reFromString(reKey),
                    replacer[reKey]
                ];
            });
            replacers[replacerKey] = (input) => {
                let out = input;
                for (const [re, str] of replacerREs) {
                    out = out.replace(re, str);
                }
                return out;
            };
        }
        for (const shaderKey in shaders) {
            const re = reFromString(shaders[shaderKey]);
            shaders[shaderKey] = reShader.bind(undefined, re);
        }
    }
    return views;
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
                const calEvents = parseCalendar(icalData);
                const views = loadViews({ "uts": { "constant": { "SUBJECT_CODE": "#DESCRIPTION" }, "variable": { "nclass": 0 }, "replace": { "abbr": { "/\\bIntroduction\\b/": "Int.", "/\\bMathematical\\b/": "Math.", "/\\bDatabase\\b/": "DB" }, "ordinal_letter": { "/1/": "A", "/2/": "B" }, "activity": { "/lec/i": "Lecture", "/tut/i": "Tutorial", "/cmp/i": "Computer Lab" }, "room": { "/ONLINE123/": "Online" } }, "event": { "shader": { "description": "/([0-9]+)_([A-Z]+)_([A-Z]+)_([0-9])_([A-Z]+), ([A-Za-z]+)([0-9]+), ([0-9]+)\\n(.+)/g" }, "article": [[["shader", "description", 0, 1], " ", ["shader", "description", 0, 9]], [["replace", ["shader", "description", 0, 6], "activity"], " for ", ["time", "duration"]], ["@ ", ["time", "start"], ["replace", ["shader", "location", 0, 0], "room"]]] } } });
                const selectedView = views["uts"];
                const evList = document.getElementById("event-list");
                evList.innerHTML = "";
                for (const ev of calEvents) {
                    if (ev.uid == "uid0")
                        console.log(ev);
                    const evItem = document.createElement("li");
                    const evArticle = document.createElement("article");
                    for (const line of selectedView.event.article) {
                        const para = document.createElement("p");
                        para.textContent = line.toString();
                        evArticle.append(para);
                    }
                    evItem.append(evArticle);
                    evList.append(evItem);
                }
            }
            catch (e) {
                if (e instanceof ICAL.parse.ParserError) {
                    alert("that url wasn't an ical file!");
                }
                else {
                    alert("FATAL!!! " + (e.message || e.toString()));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZXRhYmxlLXZpZXcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGltZXRhYmxlLXZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7d0NBR3dDOzs7Ozs7Ozs7O0FBRXhDLE1BQU0sWUFBWSxHQUFHLHNCQUFzQixDQUFDO0FBOEM1QyxzQ0FBc0M7QUFDdEMsU0FBUyxhQUFhLENBQUMsUUFBZ0I7SUFFckMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNsQyxNQUFNLE9BQU8sR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQztTQUNqRCxHQUFHLENBQUMsTUFBTSxDQUFBLEVBQUUsQ0FBQSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUV2QyxPQUFPLE1BQU0sQ0FBQztBQUVoQixDQUFDO0FBWUQsU0FBUyxZQUFZLENBQUMsTUFBYztJQUNsQyxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzFDLE9BQU8sSUFBSSxNQUFNLENBQ2YsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLEVBQzFCLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFDLENBQUMsQ0FBQyxDQUMxQixDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsUUFBUSxDQUFDLEVBQVUsRUFBRSxLQUFhO0lBQ3pDLE1BQU0sR0FBRyxHQUFzQixFQUFFLENBQUM7SUFDbEMsSUFBSSxLQUE2QixDQUFDO0lBQ2xDLEVBQUUsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0lBQ2pCLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRTtRQUNiLE9BQU8sQ0FBQyxLQUFLLEdBQUcsRUFB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LENBQUM7SUFDaEMsQ0FBQyxDQUFDLENBQUM7SUFFSCwwQkFBMEI7SUFDMUIsY0FBYyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxHQUFTLEVBQUU7UUFDbEQsSUFBSSxZQUFZLENBQUMsY0FBYyxFQUFFLEVBQUU7WUFDakMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDN0MsTUFBTSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNwQztJQUNILENBQUMsQ0FBQSxDQUFDLENBQUM7SUFFSCxxQ0FBcUM7SUFDckMsSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxJQUFJLElBQUksRUFBRTtRQUM5QyxRQUFRLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUUsQ0FBQztRQUMvQyxZQUFZLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQztRQUM5QixjQUFjLENBQUMsS0FBSyxFQUFFLENBQUM7S0FDeEI7QUFFSCxDQUFDLENBQUEsQ0FBQTtBQUVELGdDQUFnQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIFRoaXMgU291cmNlIENvZGUgRm9ybSBpcyBzdWJqZWN0IHRvIHRoZSB0ZXJtcyBvZiB0aGUgTW96aWxsYSBQdWJsaWNcclxuICogTGljZW5zZSwgdi4gMi4wLiBJZiBhIGNvcHkgb2YgdGhlIE1QTCB3YXMgbm90IGRpc3RyaWJ1dGVkIHdpdGggdGhpc1xyXG4gKiBmaWxlLCBZb3UgY2FuIG9idGFpbiBvbmUgYXQgaHR0cHM6Ly9tb3ppbGxhLm9yZy9NUEwvMi4wLy5cclxuICogQ29weXJpZ2h0IChDKSBPbGl2ZXIgTGVuZWhhbiwgMjAyMSAqL1xyXG5cclxuY29uc3QgS0VZX0lDQUxIUkVGID0gXCJ0aW1ldGFibGU6OmljYWxfaHJlZlwiO1xyXG5cclxuLy8gYXNzdW1lcyA8c2NyaXB0IHNyYz1cImxpYi9pY2FsLm1pbi5qc1wiPjwvc2NyaXB0PlxyXG5cclxuLy8gbWFudWFsbHkgdHlwZWQgZnJvbSBodHRwczovL21vemlsbGEtY29tbS5naXRodWIuaW8vaWNhbC5qcy9hcGkvaW5kZXguaHRtbFxyXG5kZWNsYXJlIG5hbWVzcGFjZSBJQ0FMIHtcclxuXHJcbiAgdHlwZSBqQ2FsID0gW3N0cmluZywgLi4uYW55W11dO1xyXG5cclxuICBmdW5jdGlvbiBwYXJzZShpQ2FsU3RyaW5nOiBzdHJpbmcpOiBqQ2FsO1xyXG4gIG5hbWVzcGFjZSBwYXJzZSB7XHJcbiAgICBjbGFzcyBQYXJzZXJFcnJvciBleHRlbmRzIEVycm9yIHt9XHJcbiAgfVxyXG5cclxuICBjbGFzcyBDb21wb25lbnQge1xyXG4gICAgY29uc3RydWN0b3IoZGF0YTogakNhbCk7XHJcbiAgICBnZXRBbGxTdWJjb21wb25lbnRzKG5hbWU/OiBzdHJpbmcpOiBJQ0FMLkNvbXBvbmVudFtdO1xyXG4gIH1cclxuXHJcbiAgaW50ZXJmYWNlIER1cmF0aW9uIHtcclxuICAgIHJlYWRvbmx5IGRheXM6IG51bWJlcjtcclxuICAgIHJlYWRvbmx5IGhvdXJzOiBudW1iZXI7XHJcbiAgICByZWFkb25seSBtaW51dGVzOiBudW1iZXI7XHJcbiAgICByZWFkb25seSBzZWNvbmRzOiBudW1iZXI7XHJcbiAgICByZWFkb25seSB3ZWVrczogbnVtYmVyO1xyXG4gIH1cclxuXHJcbiAgaW50ZXJmYWNlIFRpbWUge1xyXG4gICAgdG9KU0RhdGUoKTogRGF0ZTtcclxuICB9XHJcblxyXG4gIGNsYXNzIEV2ZW50IHtcclxuICAgIGNvbnN0cnVjdG9yKGNvbXA6IENvbXBvbmVudCk7XHJcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbjogc3RyaW5nO1xyXG4gICAgcmVhZG9ubHkgZHVyYXRpb246IElDQUwuRHVyYXRpb247XHJcbiAgICByZWFkb25seSBlbmREYXRlOiBJQ0FMLlRpbWU7XHJcbiAgICByZWFkb25seSBsb2NhdGlvbjogc3RyaW5nO1xyXG4gICAgcmVhZG9ubHkgb3JnYW5pemVyOiBzdHJpbmc7XHJcbiAgICByZWFkb25seSBzZXF1ZW5jZTogbnVtYmVyO1xyXG4gICAgcmVhZG9ubHkgc3RhcnREYXRlOiBJQ0FMLlRpbWU7XHJcbiAgICByZWFkb25seSBzdW1tYXJ5OiBzdHJpbmc7XHJcbiAgICByZWFkb25seSB1aWQ6IHN0cmluZztcclxuICB9XHJcblxyXG59XHJcblxyXG4vKiogVGhyb3dzIGBJQ0FMLnBhcnNlLlBhcnNlckVycm9yYCAqL1xyXG5mdW5jdGlvbiBwYXJzZUNhbGVuZGFyKGljYWxEYXRhOiBzdHJpbmcpIHtcclxuXHJcbiAgY29uc3QgamNhbCA9IElDQUwucGFyc2UoaWNhbERhdGEpO1xyXG4gIGNvbnN0IGNhbENvbXAgPSBuZXcgSUNBTC5Db21wb25lbnQoamNhbCk7XHJcbiAgY29uc3QgZXZlbnRzID0gY2FsQ29tcC5nZXRBbGxTdWJjb21wb25lbnRzKFwidmV2ZW50XCIpXHJcbiAgICAubWFwKHZldmVudD0+bmV3IElDQUwuRXZlbnQodmV2ZW50KSk7XHJcblxyXG4gIHJldHVybiBldmVudHM7XHJcblxyXG59XHJcblxyXG5pbnRlcmZhY2UgVGltZXRhYmxlVmlldyB7XHJcbiAgY29uc3RhbnQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXHJcbiAgdmFyaWFibGU6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4sXHJcbiAgcmVwbGFjZTogUmVjb3JkPHN0cmluZywgKGlucHV0OiBzdHJpbmcpID0+IHN0cmluZz4sXHJcbiAgZXZlbnQ6IHtcclxuICAgIHNoYWRlcjogUmVjb3JkPHN0cmluZywgKGlucHV0OiBzdHJpbmcpID0+IFtzdHJpbmcsIC4uLnN0cmluZ1tdXVtdPixcclxuICAgIGFydGljbGU6IChzdHJpbmd8YW55W10pW11bXSxcclxuICB9LFxyXG59XHJcblxyXG5mdW5jdGlvbiByZUZyb21TdHJpbmcoc291cmNlOiBzdHJpbmcpOiBSZWdFeHAge1xyXG4gIGNvbnN0IGxhc3RTbGFzaCA9IHNvdXJjZS5sYXN0SW5kZXhPZihcIi9cIik7XHJcbiAgcmV0dXJuIG5ldyBSZWdFeHAoXHJcbiAgICBzb3VyY2Uuc2xpY2UoMSwgbGFzdFNsYXNoKSxcclxuICAgIHNvdXJjZS5zbGljZShsYXN0U2xhc2grMSlcclxuICApO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZVNoYWRlcihyZTogUmVnRXhwLCBpbnB1dDogc3RyaW5nKTogUmVnRXhwRXhlY0FycmF5W10ge1xyXG4gIGNvbnN0IG91dDogUmVnRXhwRXhlY0FycmF5W10gPSBbXTtcclxuICBsZXQgbWF0Y2g6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XHJcbiAgcmUubGFzdEluZGV4ID0gMDtcclxuICBpZiAocmUuZ2xvYmFsKSB7XHJcbiAgICB3aGlsZSAoKG1hdGNoID0gcmUuZXhlYyhpbnB1dCkpICE9IG51bGwpIG91dC5wdXNoKG1hdGNoKTtcclxuICB9XHJcbiAgZWxzZSB7XHJcbiAgICBpZiAoKG1hdGNoID0gcmUuZXhlYyhpbnB1dCkpICE9IG51bGwpIG91dC5wdXNoKG1hdGNoKTtcclxuICB9XHJcbiAgcmV0dXJuIG91dDtcclxufVxyXG5cclxuZnVuY3Rpb24gbG9hZFZpZXdzKHZpZXdzOiBhbnkpOiBSZWNvcmQ8c3RyaW5nLCBUaW1ldGFibGVWaWV3PiB7XHJcbiAgZm9yIChjb25zdCB2aWV3S2V5IGluIHZpZXdzKSB7XHJcbiAgICBjb25zdCB2aWV3ID0gdmlld3Nbdmlld0tleV07XHJcbiAgICBjb25zdCByZXBsYWNlcnMgPSB2aWV3W1wicmVwbGFjZVwiXTtcclxuICAgIGNvbnN0IHNoYWRlcnMgPSB2aWV3W1wiZXZlbnRcIl1bXCJzaGFkZXJcIl07XHJcbiAgICBmb3IgKGNvbnN0IHJlcGxhY2VyS2V5IGluIHJlcGxhY2Vycykge1xyXG4gICAgICBjb25zdCByZXBsYWNlciA9IHJlcGxhY2Vyc1tyZXBsYWNlcktleV07XHJcbiAgICAgIGNvbnN0IHJlcGxhY2VyUkVzID0gT2JqZWN0LmtleXMocmVwbGFjZXIpXHJcbiAgICAgIC5tYXAocmVLZXkgPT4ge1xyXG4gICAgICAgIHJldHVybiBbXHJcbiAgICAgICAgICByZUZyb21TdHJpbmcocmVLZXkpLFxyXG4gICAgICAgICAgcmVwbGFjZXJbcmVLZXldIGFzIHN0cmluZ1xyXG4gICAgICAgIF0gYXMgY29uc3Q7XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXBsYWNlcnNbcmVwbGFjZXJLZXldID0gKGlucHV0OiBzdHJpbmcpID0+IHtcclxuICAgICAgICBsZXQgb3V0ID0gaW5wdXQ7XHJcbiAgICAgICAgZm9yIChjb25zdCBbcmUsIHN0cl0gb2YgcmVwbGFjZXJSRXMpIHtcclxuICAgICAgICAgIG91dCA9IG91dC5yZXBsYWNlKHJlLCBzdHIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gb3V0O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBmb3IgKGNvbnN0IHNoYWRlcktleSBpbiBzaGFkZXJzKSB7XHJcbiAgICAgIGNvbnN0IHJlID0gcmVGcm9tU3RyaW5nKHNoYWRlcnNbc2hhZGVyS2V5XSk7XHJcbiAgICAgIHNoYWRlcnNbc2hhZGVyS2V5XSA9IHJlU2hhZGVyLmJpbmQodW5kZWZpbmVkLCByZSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiB2aWV3cztcclxufVxyXG5cclxuLy8gYXJ0aWNsZSBtYXliZSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy85ODUyMzEyL2xpc3Qtb2YtaHRtbDUtZWxlbWVudHMtdGhhdC1jYW4tYmUtbmVzdGVkLWluc2lkZS1wLWVsZW1lbnRcclxuLy8gdXNlZnVsIGh0dHBzOi8vbGVhcm4tdGhlLXdlYi5hbGdvbnF1aW5kZXNpZ24uY2EvdG9waWNzL2h0bWwtc2VtYW50aWNzLWNoZWF0LXNoZWV0L1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlQ2FsZW5kYXJWaWV3KGljYWxocmVmOiBzdHJpbmcpIHtcclxuICBjb25zdCBjb3JzSHJlZiA9IGBodHRwczovL2FwaS5hbGxvcmlnaW5zLndpbi9yYXc/dXJsPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGljYWxocmVmKX1gXHJcbiAgY29uc3QgaWNhbFJlcyA9IGF3YWl0IGZldGNoKGNvcnNIcmVmKTtcclxuICBpZiAoaWNhbFJlcy5vaykge1xyXG4gICAgY29uc3QgaWNhbERhdGEgPSBhd2FpdCBpY2FsUmVzLnRleHQoKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNhbEV2ZW50cyA9IHBhcnNlQ2FsZW5kYXIoaWNhbERhdGEpO1xyXG4gICAgICBjb25zdCB2aWV3cyA9IGxvYWRWaWV3cyh7XCJ1dHNcIjp7XCJjb25zdGFudFwiOntcIlNVQkpFQ1RfQ09ERVwiOlwiI0RFU0NSSVBUSU9OXCJ9LFwidmFyaWFibGVcIjp7XCJuY2xhc3NcIjowfSxcInJlcGxhY2VcIjp7XCJhYmJyXCI6IHtcIi9cXFxcYkludHJvZHVjdGlvblxcXFxiL1wiOiBcIkludC5cIixcIi9cXFxcYk1hdGhlbWF0aWNhbFxcXFxiL1wiOiBcIk1hdGguXCIsXCIvXFxcXGJEYXRhYmFzZVxcXFxiL1wiOiBcIkRCXCJ9LFwib3JkaW5hbF9sZXR0ZXJcIjoge1wiLzEvXCI6IFwiQVwiLFwiLzIvXCI6IFwiQlwifSxcImFjdGl2aXR5XCI6IHtcIi9sZWMvaVwiOiBcIkxlY3R1cmVcIixcIi90dXQvaVwiOiBcIlR1dG9yaWFsXCIsXCIvY21wL2lcIjogXCJDb21wdXRlciBMYWJcIn0sXCJyb29tXCI6IHtcIi9PTkxJTkUxMjMvXCI6IFwiT25saW5lXCJ9fSxcImV2ZW50XCI6IHtcInNoYWRlclwiOiB7XCJkZXNjcmlwdGlvblwiOiBcIi8oWzAtOV0rKV8oW0EtWl0rKV8oW0EtWl0rKV8oWzAtOV0pXyhbQS1aXSspLCAoW0EtWmEtel0rKShbMC05XSspLCAoWzAtOV0rKVxcXFxuKC4rKS9nXCJ9LFwiYXJ0aWNsZVwiOiBbW1tcInNoYWRlclwiLCBcImRlc2NyaXB0aW9uXCIsIDAsIDFdLFwiIFwiLFtcInNoYWRlclwiLCBcImRlc2NyaXB0aW9uXCIsIDAsIDldXSxbW1wicmVwbGFjZVwiLCBbXCJzaGFkZXJcIiwgXCJkZXNjcmlwdGlvblwiLCAwLCA2XSwgXCJhY3Rpdml0eVwiXSxcIiBmb3IgXCIsW1widGltZVwiLCBcImR1cmF0aW9uXCJdXSxbXCJAIFwiLFtcInRpbWVcIiwgXCJzdGFydFwiXSxbXCJyZXBsYWNlXCIsIFtcInNoYWRlclwiLCBcImxvY2F0aW9uXCIsIDAsIDBdLCBcInJvb21cIl1dXX19fSk7XHJcbiAgICAgIGNvbnN0IHNlbGVjdGVkVmlldyA9IHZpZXdzW1widXRzXCJdO1xyXG4gICAgICBjb25zdCBldkxpc3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImV2ZW50LWxpc3RcIikgYXMgSFRNTE9MaXN0RWxlbWVudDtcclxuICAgICAgZXZMaXN0LmlubmVySFRNTCA9IFwiXCI7XHJcbiAgICAgIGZvciAoY29uc3QgZXYgb2YgY2FsRXZlbnRzKSB7XHJcbiAgICAgICAgaWYgKGV2LnVpZCA9PSBcInVpZDBcIikgY29uc29sZS5sb2coZXYpO1xyXG4gICAgICAgIGNvbnN0IGV2SXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcclxuICAgICAgICBjb25zdCBldkFydGljbGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYXJ0aWNsZVwiKTtcclxuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2Ygc2VsZWN0ZWRWaWV3LmV2ZW50LmFydGljbGUpIHtcclxuICAgICAgICAgIGNvbnN0IHBhcmEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwicFwiKTtcclxuICAgICAgICAgIHBhcmEudGV4dENvbnRlbnQgPSBsaW5lLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICBldkFydGljbGUuYXBwZW5kKHBhcmEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBldkl0ZW0uYXBwZW5kKGV2QXJ0aWNsZSk7XHJcbiAgICAgICAgZXZMaXN0LmFwcGVuZChldkl0ZW0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZTogYW55KSB7XHJcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgSUNBTC5wYXJzZS5QYXJzZXJFcnJvcikge1xyXG4gICAgICAgIGFsZXJ0KFwidGhhdCB1cmwgd2Fzbid0IGFuIGljYWwgZmlsZSFcIik7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgYWxlcnQoXCJGQVRBTCEhISBcIiArIChlLm1lc3NhZ2UgfHwgZS50b1N0cmluZygpKSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbiAgZWxzZSB7XHJcbiAgICBhbGVydChcImZhaWxlZCB0byBsb2FkIGljYWwgZmlsZSA6KFwiKTtcclxuICB9XHJcbn1cclxuXHJcbndpbmRvdy5vbmxvYWQgPSBhc3luYyAoKSA9PiB7XHJcblxyXG4gIGNvbnN0IGljYWxJbnB1dEJveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaWNhbC11cmxcIikgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICBjb25zdCBpY2FsTG9hZEJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaWNhbC1sb2FkXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG5cclxuICBsZXQgaWNhbEhyZWY6IHN0cmluZztcclxuXHJcbiAgLy8gdXBkYXRlIGljYWxIcmVmIG9uIGlucHV0IGludG8gYm94XHJcbiAgaWNhbElucHV0Qm94LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XHJcbiAgICBpY2FsSHJlZiA9IGljYWxJbnB1dEJveC52YWx1ZTtcclxuICB9KTtcclxuXHJcbiAgLy8gMS4gb24gbG9hZCBidXR0b24gcHJlc3NcclxuICBpY2FsTG9hZEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKGljYWxJbnB1dEJveC5yZXBvcnRWYWxpZGl0eSgpKSB7XHJcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKEtFWV9JQ0FMSFJFRiwgaWNhbEhyZWYpO1xyXG4gICAgICBhd2FpdCB1cGRhdGVDYWxlbmRhclZpZXcoaWNhbEhyZWYpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICAvLyAyLiBmZXRjaCBmcm9tIGxvY2Fsc3RvcmFnZSBvbiBpbml0XHJcbiAgaWYgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKEtFWV9JQ0FMSFJFRikgIT0gbnVsbCkge1xyXG4gICAgaWNhbEhyZWYgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShLRVlfSUNBTEhSRUYpITtcclxuICAgIGljYWxJbnB1dEJveC52YWx1ZSA9IGljYWxIcmVmO1xyXG4gICAgaWNhbExvYWRCdXR0b24uY2xpY2soKTtcclxuICB9XHJcblxyXG59XHJcblxyXG4vLyBwYXJzZSBldmVudCB0ZXh0IC8gZGF0YSBibG9jayJdfQ==