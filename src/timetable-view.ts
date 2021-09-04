/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */

// Future Optimsation by loading content parallel
// then wait for DOM at end

/* Setup */
// <script src="lib/ical.min.js"></script>

/* localStorage Keys */

const KEY_ICALHREF = "timetable::ical_href";
const KEY_VIEWID = "timetable::view_id";

/* Interfaces */

interface ArticleState {
  event: ICAL.Event;
}

interface EventsView {
  title: string,
  variables: Record<string, number | string>;
  replacers: Record<string, (input: string) => string>;
  shaders: Record<string, (input: string) => RegExpExecArray[]>;
  buildArticle(state: ArticleState): HTMLElement;
}

/*  */

function encodeHTML(text: string): string {
  text = text.replace(/&/g, "&amp;");
  text = text.replace(/</g, "&lt;");
  text = text.replace(/>/g, "&gt;");
  text = text.replace(/"/g, "&quot;");
  text = text.replace(/'/g, "&apos;");
  return text;
}

interface Defer<T> extends Promise<T> {
  resolve(value: T | PromiseLike<T>): void;
  reject(reason?: any): void;
}

function defer<T>(): Defer<T> {
  const deferObj = {
    resolve: null as any,
    reject: null as any,
  };
  const promise = new Promise<T>((res, rej)=>{
    deferObj.resolve = res;
    deferObj.reject = rej;
  });
  return Object.assign(promise, deferObj);
}

namespace TTV {

  export const elements = {
    icalUrlInput: defer<HTMLInputElement>(),
    icalLoadButton: defer<HTMLButtonElement>(),
    eventsOList: defer<HTMLOListElement>(),
    viewCssLink: defer<HTMLLinkElement>(),
    eventsDateInput: defer<HTMLInputElement>(),
    ttvResetButton: defer<HTMLButtonElement>(),
    ttvViewInput: defer<HTMLInputElement>(),
    viewTitleHeading: defer<HTMLHeadingElement>(),
  };

  export const loaded = {
    events: [] as ICAL.Event[],
    icalHref: "",
    viewId: "",
    viewJson: {},
  };

  export const config = {
    CORS_URL: "https://api.allorigins.win/raw?url=%s",
  };

  // article maybe https://stackoverflow.com/questions/9852312/list-of-html5-elements-that-can-be-nested-inside-p-element
  // useful https://learn-the-web.algonquindesign.ca/topics/html-semantics-cheat-sheet/

  export async function updateCalendarView(icalHref: string, viewId: string, today = ICAL.Time.now()) {

    const [
      eventsOList,
      viewCssLink,
      viewTitleHeading,
    ] = await Promise.all([
      TTV.elements.eventsOList,
      TTV.elements.viewCssLink,
      TTV.elements.viewTitleHeading,
    ]);
    
    viewCssLink.href = `./views/${viewId}.css`;

    const corsHref = TTV.config.CORS_URL.replace("%s", encodeURIComponent(icalHref));
    const icalRes = await fetch(corsHref);

    if (icalRes.ok) {
      const icalData = await icalRes.text();
      try {
        // this may throw on invalid icalendar data
        const calEvents = parseCalendar(icalData);
        const viewJson = JSON.parse(await (await fetch(`./views/${viewId}.json`)).text());
        
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
            evItem.append(view.buildArticle({event}));
            eventsOList.append(evItem);
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

  /** Throws `ICAL.parse.ParserError` */
  function parseCalendar(icalData: string) {
  
    const jcal = ICAL.parse(icalData);
    const calComp = new ICAL.Component(jcal);
    const events = calComp.getAllSubcomponents("vevent")
      .map(vevent=>new ICAL.Event(vevent));
    
    return events;
  
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

    const title = viewJson["title"] || "Timetable View";

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
              out = encodeHTML(compilationResult?.[matchNum]?.[groupNum] ?? "");
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
      title, variables, replacers, shaders,
      buildArticle: (state: ArticleState) => {
  
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
    }
  
  }

}

/* Main */

window.addEventListener("DOMContentLoaded", () => {
  TTV.elements.eventsOList.resolve(document.getElementById("events") as any);
  TTV.elements.icalUrlInput.resolve(document.getElementById("ical-url") as any);
  TTV.elements.icalLoadButton.resolve(document.getElementById("ical-load") as any);
  TTV.elements.eventsDateInput.resolve(document.getElementById("events-date") as any);
  TTV.elements.viewCssLink.resolve(document.getElementById("view-css") as any);
  TTV.elements.ttvResetButton.resolve(document.getElementById("ttv-reset") as any);
  TTV.elements.ttvViewInput.resolve(document.getElementById("ttv-view") as any);
  TTV.elements.viewTitleHeading.resolve(document.getElementById("view-title") as any);
});

TTV.elements.ttvResetButton.then(ele=>{
  ele.addEventListener("click", () => {
    localStorage.removeItem(KEY_ICALHREF);
    localStorage.removeItem(KEY_VIEWID);
    window.location.reload();
  });
});

window.addEventListener("load", async () => {

  const [
    icalLoadButton,
    icalUrlInput,
    eventsDateInput,
    ttvViewInput,
  ] = await Promise.all([
    TTV.elements.icalLoadButton,
    TTV.elements.icalUrlInput,
    TTV.elements.eventsDateInput,
    TTV.elements.ttvViewInput,
  ]);

  const now = ICAL.Time.now();
  eventsDateInput.valueAsDate = now.toJSDate();

  let icalHref: string;

  // update icalHref on input into box
  icalUrlInput.addEventListener("input", () => {
    icalHref = icalUrlInput.value;
  });

  // 1. on load button press
  icalLoadButton.addEventListener("click", async () => {
    if (
      icalUrlInput.reportValidity()
      && eventsDateInput.reportValidity()
      && ttvViewInput.reportValidity()
    ) {
      console.log(eventsDateInput.valueAsDate!);
      localStorage.setItem(KEY_ICALHREF, icalHref);
      // localStorage.setItem(KEY_VIEWID, icalHref);
      await TTV.updateCalendarView(
        icalHref,
        ttvViewInput.value,
        ICAL.Time.fromJSDate(eventsDateInput.valueAsDate!)
      );
    }
  });

  // 2. fetch from localstorage on init
  if (localStorage.getItem(KEY_ICALHREF) != null) {
    icalHref = localStorage.getItem(KEY_ICALHREF)!;
    icalUrlInput.value = icalHref;
    if (icalUrlInput.reportValidity()) {
      localStorage.setItem(KEY_ICALHREF, icalHref);
      await TTV.updateCalendarView(icalHref, "uts", now);
    }
  }

});
