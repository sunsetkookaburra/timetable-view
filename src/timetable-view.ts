/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */

const KEY_ICALHREF = "timetable::ical_href";

// assumes <script src="lib/ical.min.js"></script>

// manually typed from https://mozilla-comm.github.io/ical.js/api/index.html
declare namespace ICAL {

  type jCal = [string, ...any[]];

  function parse(iCalString: string): jCal;
  namespace parse {
    class ParserError extends Error {}
  }

  class Component {
    constructor(data: jCal);
    getAllSubcomponents(name?: string): ICAL.Component[];
  }

  interface Duration {
    readonly days: number;
    readonly hours: number;
    readonly minutes: number;
    readonly seconds: number;
    readonly weeks: number;
  }

  interface Time {
    toJSDate(): Date;
  }

  class Event {
    constructor(comp: Component);
    readonly description: string;
    readonly duration: ICAL.Duration;
    readonly endDate: ICAL.Time;
    readonly location: string;
    readonly organizer: string;
    readonly sequence: number;
    readonly startDate: ICAL.Time;
    readonly summary: string;
    readonly uid: string;
  }

}

/** Throws `ICAL.parse.ParserError` */
function parseCalendar(icalData: string) {

  const jcal = ICAL.parse(icalData);
  const calComp = new ICAL.Component(jcal);
  const events = calComp.getAllSubcomponents("vevent")
    .map(vevent=>new ICAL.Event(vevent));

  return events;

}

interface TimetableView {
  constant: Record<string, string>,
  variable: Record<string, number>,
  replace: Record<string, (input: string) => string>,
  event: {
    shader: Record<string, (input: string) => [string, ...string[]][]>,
    article: (string|any[])[][],
  },
}

function reFromString(source: string): RegExp {
  const lastSlash = source.lastIndexOf("/");
  return new RegExp(
    source.slice(1, lastSlash),
    source.slice(lastSlash+1)
  );
}

function reShader(re: RegExp, input: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  re.lastIndex = 0;
  if (re.global) {
    while ((match = re.exec(input)) != null) out.push(match);
  }
  else {
    if ((match = re.exec(input)) != null) out.push(match);
  }
  return out;
}

function loadViews(views: any): Record<string, TimetableView> {
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
          replacer[reKey] as string
        ] as const;
      });
      replacers[replacerKey] = (input: string) => {
        let out = input;
        for (const [re, str] of replacerREs) {
          out = out.replace(re, str);
        }
        return out;
      }
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

async function updateCalendarView(icalhref: string) {
  const corsHref = `https://api.allorigins.win/raw?url=${encodeURIComponent(icalhref)}`
  const icalRes = await fetch(corsHref);
  if (icalRes.ok) {
    const icalData = await icalRes.text();
    try {
      const calEvents = parseCalendar(icalData);
      const views = loadViews({"uts":{"constant":{"SUBJECT_CODE":"#DESCRIPTION"},"variable":{"nclass":0},"replace":{"abbr": {"/\\bIntroduction\\b/": "Int.","/\\bMathematical\\b/": "Math.","/\\bDatabase\\b/": "DB"},"ordinal_letter": {"/1/": "A","/2/": "B"},"activity": {"/lec/i": "Lecture","/tut/i": "Tutorial","/cmp/i": "Computer Lab"},"room": {"/ONLINE123/": "Online"}},"event": {"shader": {"description": "/([0-9]+)_([A-Z]+)_([A-Z]+)_([0-9])_([A-Z]+), ([A-Za-z]+)([0-9]+), ([0-9]+)\\n(.+)/g"},"article": [[["shader", "description", 0, 1]," ",["shader", "description", 0, 9]],[["replace", ["shader", "description", 0, 6], "activity"]," for ",["time", "duration"]],["@ ",["time", "start"],["replace", ["shader", "location", 0, 0], "room"]]]}}});
      const selectedView = views["uts"];
      const evList = document.getElementById("event-list") as HTMLOListElement;
      evList.innerHTML = "";
      for (const ev of calEvents) {
        if (ev.uid == "uid0") console.log(ev);
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
    catch (e: any) {
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
}

window.onload = async () => {

  const icalInputBox = document.getElementById("ical-url") as HTMLInputElement;
  const icalLoadButton = document.getElementById("ical-load") as HTMLButtonElement;

  let icalHref: string;

  // update icalHref on input into box
  icalInputBox.addEventListener("input", () => {
    icalHref = icalInputBox.value;
  });

  // 1. on load button press
  icalLoadButton.addEventListener("click", async () => {
    if (icalInputBox.reportValidity()) {
      localStorage.setItem(KEY_ICALHREF, icalHref);
      await updateCalendarView(icalHref);
    }
  });

  // 2. fetch from localstorage on init
  if (localStorage.getItem(KEY_ICALHREF) != null) {
    icalHref = localStorage.getItem(KEY_ICALHREF)!;
    icalInputBox.value = icalHref;
    icalLoadButton.click();
  }

}

// parse event text / data block