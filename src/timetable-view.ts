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
    compare(aOther: ICAL.Time): -1 | 0 | 1;
    dayOfYear(): number;
  }

  namespace Time {
    function now(): ICAL.Time;
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

function encodeHTML(text: string): string {
  text = text.replace(/&/g, "&amp;");
  text = text.replace(/</g, "&lt;");
  text = text.replace(/>/g, "&gt;");
  text = text.replace(/"/g, "&quot;");
  text = text.replace(/'/g, "&apos;");
  return text;
}

/** Throws `ICAL.parse.ParserError` */
function parseCalendar(icalData: string) {

  const jcal = ICAL.parse(icalData);
  const calComp = new ICAL.Component(jcal);
  const events = calComp.getAllSubcomponents("vevent")
    .map(vevent=>new ICAL.Event(vevent));
  
  return events;

}

interface ArticleState {
  event: ICAL.Event;
}

interface EventsView {
  variables: Record<string, number | string>;
  replacers: Record<string, (input: string) => string>;
  shaders: Record<string, (input: string) => RegExpExecArray[]>;
  buildArticle(state: ArticleState): HTMLElement;
}

function buildRegExp(literal: string): RegExp {

  const lastSlash = literal.lastIndexOf("/");

  const re = new RegExp(
    literal.slice(1, lastSlash),
    literal.slice(lastSlash+1)
  );

  return re;

}

function buildReplacer(replacerJson: Record<string, string>): (input: string) => string {

  const regexAndReplaceStringArr: [RegExp, string][] = [];

  for (const regexLiteralKey in replacerJson) {
    regexAndReplaceStringArr.push([
      buildRegExp(regexLiteralKey),
      replacerJson[regexLiteralKey],
    ]);
  }

  const fn = (input: string) => {
    let out = input;
    for (const [re, str] of regexAndReplaceStringArr) {
      out = out.replace(re, str);
    }
    return out;
  };
  
  return fn;

}

function buildShader(shaderLiteral: string): (input: string) => RegExpExecArray[] {

  const re = buildRegExp(shaderLiteral);

  const fn = (input: string) => {
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
  };

  return fn;

}

function buildEventsView(viewJson: any): EventsView {

  const variables: Record<string, number | string> = viewJson["variables"];

  const replacers = (()=>{
    let replacersObj: Record<string, ReturnType<typeof buildReplacer>> = {};
    for (const replacerKey in viewJson["replacers"]) {
      replacersObj[replacerKey] = buildReplacer(viewJson["replacers"][replacerKey]);
    }
    return replacersObj;
  })();

  const shaders = (()=>{
    let shadersObj: Record<string, ReturnType<typeof buildShader>> = {};
    for (const shaderKey in viewJson["shaders"]) {
      shadersObj[shaderKey] = buildShader(viewJson["shaders"][shaderKey]);
    }
    return shadersObj;
  })();

  const compiledShaders = new Map<string, RegExpMatchArray[]>();

  type Lexeme = string | number | [name: string, ...args: any/*Lexeme*/[]];

  // has capability for advanced recursion of every attribute,
  // currently removed for optimisation (and not seen as necessary yet)
  // also responsible for escaping html chars
  function evalLexeme(state: ArticleState, lexeme: Lexeme): string {
    let out: string;
    if (typeof lexeme == "string") {
      out = encodeHTML(lexeme);
    }
    else if (typeof lexeme == "number") {
      out = encodeHTML(lexeme.toString());
    }
    else {
      switch (/*fn_name*/lexeme[0]) {
        case "replace": {
          const originalText = evalLexeme(state, lexeme[1]);
          const replacerKey = lexeme[2];
          out = encodeHTML(replacers[replacerKey](originalText));
          break;
        }
        case "shader": {
          const inputText = evalLexeme(state, lexeme[1]);
          const shaderKey: string = lexeme[2];
          const matchNum: number = lexeme[3];
          const groupNum: number = lexeme[4];
          const compiledShaderKey = inputText+"\x00\x7F\x00"+shaderKey;
          if (compiledShaders.has(compiledShaderKey)) {
            out = encodeHTML(compiledShaders.get(compiledShaderKey)?.[matchNum]?.[groupNum] ?? "");
          }
          else {
            const compilationResult = shaders[shaderKey](inputText);
            compiledShaders.set(compiledShaderKey, compilationResult);
            out = encodeHTML(compiledShaderKey?.[matchNum]?.[groupNum] ?? "");
          }
          break;
        }
        case "event": {
          const eventPropertyKey: string = lexeme[1];
          switch (eventPropertyKey) {
            case "description":
              out = encodeHTML(state.event.description);
              break;
            case "location":
              out = encodeHTML(state.event.location);
              break;
            case "duration":
              let dur = state.event.duration;
              out = encodeHTML(`${dur.weeks}w${dur.days}d${dur.hours}h${dur.minutes}m${dur.seconds}s`);
              break;
            case "start":
              let start = state.event.startDate;
              out = encodeHTML(start.toJSDate().toLocaleString());
              break;
            default:
              out = encodeHTML("");
              break;
          }
          break;
        }
        // UNSAFE
        case "<span>": {
          const content = evalLexeme(state, lexeme[1]);
          const classList: string = lexeme[2];
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
    variables, replacers, shaders,
    buildArticle: (state: ArticleState) => {

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
  }

}

// article maybe https://stackoverflow.com/questions/9852312/list-of-html5-elements-that-can-be-nested-inside-p-element
// useful https://learn-the-web.algonquindesign.ca/topics/html-semantics-cheat-sheet/

async function updateCalendarView(icalhref: string) {
  const corsHref = `https://api.allorigins.win/raw?url=${encodeURIComponent(icalhref)}`
  const icalRes = await fetch(corsHref);
  if (icalRes.ok) {
    const icalData = await icalRes.text();
    try {
      // this may throw on invalid icalendar data
      const calEvents = parseCalendar(icalData);
      const viewsJson = JSON.parse(await (await fetch("./views.json")).text());
      (globalThis as any)["TTV_VIEWS"] = viewsJson;
      (globalThis as any)["TTV_EVENTS"] = calEvents;
      const view = buildEventsView(viewsJson["uts"]);
      const evList = document.getElementById("event-list") as HTMLOListElement;
      evList.innerHTML = "";
      const now = ICAL.Time.now();
      for (const event of calEvents) {
        if (event.startDate.dayOfYear() <= now.dayOfYear() && now.dayOfYear() <= event.endDate.dayOfYear()) {
          const evItem = document.createElement("li");
          evItem.append(view.buildArticle({event}));
          evList.append(evItem);
        }
      }
    }
    catch (e: any) {
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