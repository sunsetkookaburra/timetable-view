/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */

// Future Optimsation by loading content parallel
// then wait for DOM at end

/* Setup */
// <script src="lib/ical.min.js"></script>

// https://codemix.com/opaque-types-in-javascript/
type Opaque<K, T> = T & { __TYPE__: K };

/** A string like `"/abc/gi"` */
type RegexLiteralString = Opaque<"RegexLiteralString", string>;

/** A string like `"start-$1-end"` */
type RegexReplaceString = Opaque<"RegexReplaceString", string>;

/** Text that has been safely HTML encoded. */
type HTMLEncodedString = Opaque<"HTMLEncodedString", string>;

namespace ViewScript {

  export type Value = string | number;

  // className=... represents html class="...", like Element.className
  export type Fn =
  | [id: "replace",   input:   Token, key: Value                                   ]
  | [id: "shader",    input:   Token, key: Value, matchNum: Value, groupNum: Value ]
  | [id: "var",       key:     Value                                               ]
  | [id: "<strong>",  content: Token, className?: string                           ]
  | [id: "<em>",      content: Token, className?: string                           ]
  | [id: "<b>",       content: Token, className?: string                           ]
  | [id: "<i>",       content: Token, className?: string                           ]
  | [id: "<span>",    content: Token, className?: string                           ]
  | [id: "<time>",    content: Token, className?: string                           ]
  | [id: "<abbr>",    content: Token, className?: string                           ];

  export type Token = Value | Fn;

  export type Line = Token[];

}

interface ViewJSON {
  title: string;
  variables: Record<string, string | number>;
  replacers: Record<string, [RegexLiteralString, RegexReplaceString][]>;
  shaders: Record<string, RegexLiteralString>;
  article: ViewScript.Line[];
}

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


// type Lexeme = string | number | [name: string, ...args: any/*Lexeme*/[]];


/*  */

function encodeHTML(text: string): HTMLEncodedString {
  text = text.replace(/&/g, "&amp;");
  text = text.replace(/</g, "&lt;");
  text = text.replace(/>/g, "&gt;");
  text = text.replace(/"/g, "&quot;");
  text = text.replace(/'/g, "&apos;");
  return text as HTMLEncodedString;
}

function padStart(data: string, size: number, fill: string): string {
  return fill
    .repeat(Math.ceil(size / fill.length))
    .slice(0, size - data.length)
    + data;
}

/** `YEAR-0M-0D` */
function localDateStr(date: Date): string {
  return date.getFullYear().toString()
  + "-" + padStart((date.getMonth()+1).toString(), 2, '0')
  + "-" + padStart(date.getDate().toString(), 2, '0') as any;
}

/** `0h:0m:0s` */
function localTimeStr(date: Date) {
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
class NamespacedStorage<K extends string> {

  /** A wrapper to represent namespaced keys in a `Storage` instance (typically either `localStorage` or `cacheStorage`).  
   * + `store` is the `Storage` instance to apply namespacing to.  
   * + `namespace` represents the `prefix::` applied to create the appearance of namespaces. */
  constructor(private store: Storage, private namespace: string) {}

  /** Set a `namespace::key` to `value`. */
  set(key: K, value: string) {
    this.store.setItem(`${this.namespace}::${key}`, value);
  }

  /** Set a `namespace::key` to `value`, only if it doesn't already exist (think defaults).
   * Returns true if the value was missing, and thus set. */
  setIfNull(key: K, value: string): boolean {
    if (this.get(key) == null) {
      this.set(key, value);
      return true;
    } else {
      return false;
    }
  }

  /** Get the value of `namespace::key`. */
  get(key: K): string | null {
    return this.store.getItem(`${this.namespace}::${key}`);
  }

  /** Delete the entry for `namespace::key`. */
  delete(key: K): void {
    this.store.removeItem(key);
  }

  /** Flush all `namespace::*` entries. */
  clear(): void {
    const keys: string[] = [];
    const storeSize = this.store.length;
    for (let i = 0; i < storeSize; ++i) {
      const k = this.store.key(i)!;
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
namespace TTV {

  export type ConfigKeys =
  | "ical_href"
  | "jcal_data"
  | "view_id"
  | "view_data"
  | "cors_url";

  /** Global configuration for TimetableView */
  export const config = new NamespacedStorage<ConfigKeys>(localStorage, "timetable_view");
  // Set config defaults
  config.setIfNull("cors_url", "https://api.allorigins.win/raw?url=%s");

  /** Stores the parameters used to load the current view. */
  export const loaded: {
    now: Date,
    events: ICAL.Event[],
    icalHref: string
    viewId: string,
    viewJson: Record<string, any>,
    view: EventsView,
  } = {} as any;

  /** Ready when `DOMContentLoaded` */
  export const elements: {
    eventsOList:      HTMLOListElement,
    eventsDateInput:  HTMLInputElement,
    icalUrlInput:     HTMLInputElement,
    icalLoadButton:   HTMLButtonElement,
    viewTitleHeading: HTMLHeadingElement,
    viewCssLink:      HTMLLinkElement,
    ttvResetButton:   HTMLButtonElement,
    ttvViewInput:     HTMLInputElement,
    ttvPrevButton:    HTMLButtonElement,
    ttvNextButton:    HTMLButtonElement,
    ttvEventsHeading: HTMLHeadingElement,
  } = {} as any;

  window.addEventListener("DOMContentLoaded", () => {
    TTV.elements.eventsOList =      document.getElementById("events")       as HTMLOListElement;
    TTV.elements.eventsDateInput =  document.getElementById("events-date")  as HTMLInputElement;
    TTV.elements.icalUrlInput =     document.getElementById("ical-url")     as HTMLInputElement;
    TTV.elements.icalLoadButton =   document.getElementById("ical-load")    as HTMLButtonElement;
    TTV.elements.viewTitleHeading = document.getElementById("view-title")   as HTMLHeadingElement;
    TTV.elements.viewCssLink =      document.getElementById("view-css")     as HTMLLinkElement;
    TTV.elements.ttvResetButton =   document.getElementById("ttv-reset")    as HTMLButtonElement;
    TTV.elements.ttvViewInput =     document.getElementById("ttv-view")     as HTMLInputElement;
    TTV.elements.ttvPrevButton =    document.getElementById("ttv-prev")     as HTMLButtonElement;
    TTV.elements.ttvNextButton =    document.getElementById("ttv-next")     as HTMLButtonElement;
    TTV.elements.ttvEventsHeading = document.getElementById("ttv-events-heading") as HTMLHeadingElement;
  });
  
  // article maybe https://stackoverflow.com/questions/9852312/list-of-html5-elements-that-can-be-nested-inside-p-element
  // useful https://learn-the-web.algonquindesign.ca/topics/html-semantics-cheat-sheet/

  // split up
  // 

  // export async function createEventsList(): HTMLLIElement[] {

  // }

  /** Must only be called after `DOMContentLoaded` event */
  export async function updateCalendarView(opt: { icalHref: string, viewId: string, forDate: Date, refresh: boolean }) {

    let events: ICAL.Event[];
    let viewJson: ViewJSON;
    let view: EventsView;

    // we've forced a refresh or the icalHref is 'new' (not currently loaded)
    if (
      opt.refresh
      || opt.icalHref != TTV.config.get("ical_href")
      || TTV.config.get("ical_href") == null
      || TTV.config.get("jcal_data") == null
    ) {
      TTV.config.set("ical_href", opt.icalHref);

      const icalCorsUrl = TTV.config.get("cors_url")!.replace("%s", encodeURIComponent(opt.icalHref));
      const icalResponse = await fetch(icalCorsUrl);

      // if (icalResponse.ok) ...

      // we assume that ical/json data in this if-block is valid and does not throw
      const icalData = await icalResponse.text();

      // parse and store jcal parsed version of our calendar
      // May throw ICAL.parse.ParserError
      const jcalJson = ICAL.parse(icalData);
      TTV.config.set("jcal_data", JSON.stringify(jcalJson));

      events = parseJcal(jcalJson);
    }
    else {
      events = parseJcal(JSON.parse(TTV.config.get("jcal_data")!));
    }

    if (
      opt.refresh
      || opt.viewId != TTV.config.get("view_id")
      || TTV.config.get("view_id") == null
      || TTV.config.get("view_data") == null
    ) {
      // might be better off fetching normally/typically/standard-way like browser does for css
      const viewData = await (await fetch(`./views/${opt.viewId}.json`)).text();
      TTV.config.set("view_id", opt.viewId);
      TTV.config.set("view_data", viewData);
      viewJson = JSON.parse(viewData);
      view = buildEventsView(viewJson);
    }
    else {
      viewJson = JSON.parse(TTV.config.get("view_data")!);
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
        evItem.append(view.buildArticle({event}));
        TTV.elements.eventsOList.append(evItem);
      }
    }

    TTV.loaded.events = events;
    TTV.loaded.icalHref = opt.icalHref;
    TTV.loaded.viewId = opt.viewId;
    TTV.loaded.viewJson = viewJson;
    TTV.loaded.view = view;
  }

  function parseJcal(jcalJson: ICAL.jCal) {
  
    const calComp = new ICAL.Component(jcalJson);
    const rawEvents = calComp.getAllSubcomponents("vevent");
    const events = rawEvents.map(vevent=>new ICAL.Event(vevent));
    // JSON.stringify(rawEvents);
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

  /** Given an array of `[RegExp, RegExp_replacerString]` pairs,
   * returns a function that transforms a string input by applying the 'rules' in the array in order. */
  function buildReplacer(replacerRules: [RegExp, string][]): (input: string) => string {

    // const regexAndReplaceStringArr: [RegExp, string][] = [];
  
    // for (const [regexStringLiteral, replacerString] of replacerRules) {
    //   regexAndReplaceStringArr.push([
    //     buildRegExp(regexStringLiteral),
    //     replacerString,
    //   ]);
    // }
  
    const fn = (input: string) => {
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

  /** Build */
  function buildShader(re: RegExp): (input: string) => RegExpExecArray[] {
  
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

  function buildEventsView(viewJson: ViewJSON): EventsView {

    const title = viewJson["title"] || "Timetable View";

    const variables: Record<string, number | string> = viewJson["variables"];
  
    const replacers = (()=>{
      let replacersObj: Record<string, ReturnType<typeof buildReplacer>> = {};
      for (const replacerKey in viewJson["replacers"]) {
        replacersObj[replacerKey] = buildReplacer(
          viewJson["replacers"][replacerKey]
          .map(([regexStringLiteral, replaceString])=>[
            buildRegExp(regexStringLiteral), replaceString])
        );
      }
      return replacersObj;
    })();
  
    const shaders = (()=>{
      let shadersObj: Record<string, ReturnType<typeof buildShader>> = {};
      for (const shaderKey in viewJson["shaders"]) {
        const re = buildRegExp(viewJson["shaders"][shaderKey] as string);
        shadersObj[shaderKey] = buildShader(re);
      }
      return shadersObj;
    })();
  
    const compiledShaders = new Map<string, RegExpMatchArray[]>();
  
    // has capability for advanced recursion of every attribute,
    // currently removed for optimisation (and not seen as necessary yet)
    // also responsible for escaping html chars
    function evalToken(state: ArticleState, token: ViewScript.Token): HTMLEncodedString {
      let out: HTMLEncodedString;
      if (typeof token == "string") {
        out = encodeHTML(token);
      }
      else if (typeof token == "number") {
        out = encodeHTML(token.toString());
      }
      else {
        switch (/*fn_name*/token[0]) {
          case "replace": {
            const originalText = evalToken(state, token[1]);
            const replacerKey = token[2];
            out = encodeHTML(replacers[replacerKey](originalText));
            break;
          }
          case "shader": {
            const inputText = evalToken(state, token[1]);
            const shaderKey: string = token[2].toString();
            const matchNum: number = parseInt(token[3].toString());
            const groupNum: number = parseInt(token[4].toString());
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
          case "var": {
            const varKey: string = token[1].toString();
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
                break;
              default: {
                if (variables[varKey] != undefined) {
                  out = encodeHTML(variables[varKey].toString())
                }
                else {
                  out = "" as HTMLEncodedString;
                }
                break;
              }
            }
            break;
          }
          // UNSAFE
          case "<span>": {
            const content: HTMLEncodedString = evalToken(state, token[1]);
            const classList: HTMLEncodedString = encodeHTML(token[2] ?? "");
            out = `<span class="${classList}">${content}</span>` as HTMLEncodedString;
            break;
          }
          // UNSAFE
          case "<strong>": {
            const content: HTMLEncodedString = evalToken(state, token[1]);
            out = `<strong>${content}</strong>` as HTMLEncodedString;
            break;
          }
          // UNSAFE
          case "<em>": {
            const content: HTMLEncodedString = evalToken(state, token[1]);
            out = `<em>${content}</em>` as HTMLEncodedString;
            break;
          }
          // UNSAFE
          case "<i>": {
            const content: HTMLEncodedString = evalToken(state, token[1]);
            out = `<i>${content}</i>`as HTMLEncodedString;
            break;
          }
          // UNSAFE
          case "<b>": {
            const content: HTMLEncodedString = evalToken(state, token[1]);
            out = `<b>${content}</b>` as HTMLEncodedString;
            break;
          }
          // UNSAFE
          case "<time>": {
            const content: HTMLEncodedString = evalToken(state, token[1]);
            out = `<time>${content}</time>` as HTMLEncodedString;
            break;
          }
          // UNSAFE
          case "<abbr>": {
            const content: HTMLEncodedString = evalToken(state, token[1]);
            out = `<time>${content}</time>` as HTMLEncodedString;
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
            pEle.insertAdjacentHTML("beforeend", evalToken(state, phrase));
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

  const now = new Date();

  // setup initial values for input elements

  TTV.elements.eventsDateInput.value = localDateStr(now);

  if (TTV.config.get("ical_href") != null) {
    TTV.elements.icalLoadButton.textContent = "Reload Calendar";
  }

  // setup event handlers

  /** Returns true if updated; */
  function checkValidInputsAndUpdate(refresh = false): boolean {
    if (
      TTV.elements.icalUrlInput.reportValidity()
      && TTV.elements.eventsDateInput.reportValidity()
      && TTV.elements.ttvViewInput.reportValidity()
    ) {
      TTV.updateCalendarView({
        forDate: TTV.elements.eventsDateInput.valueAsDate!,
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
    if (checkValidInputsAndUpdate(refresh=true)) {
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
})
