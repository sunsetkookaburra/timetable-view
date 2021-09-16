/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */

// Future Optimsation by loading content parallel
// then wait for DOM at end

// Dependencies
// <script src="lib/ical.min.js"></script>

interface ViewJSON {
  title: string;
  variables: Record<string, string>;
  replacers: Record<string, [RegexLiteralString, RegexReplaceString][]>;
  shaders: Record<string, RegexLiteralString>;
  article: ViewScript.SourceCodeProgram[];
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
    ttvViewSelect:    HTMLSelectElement,
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
    TTV.elements.ttvViewSelect =     document.getElementById("ttv-view")    as HTMLSelectElement;
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
      const icalResponse = await fetch(icalCorsUrl, { cache: "reload" });

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
      const viewData = await (await fetch(`./views/${opt.viewId}.json`, { cache: "reload" })).text();
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
        const evPos = nowPos / duration;
        const evProgress = Math.min(Math.max(evPos, 0), 1);

        evItem.style.setProperty("--event-progress", evProgress.toFixed(2));

        evItem.style.setProperty("--event-past", (evPos >= 1) ? '1' : '0');
        if (evPos >= 1) evItem.setAttribute("data-event-past", "");

        evItem.style.setProperty("--event-now", (evPos >= 0 && evPos < 1) ? '1' : '0');
        if (evPos >= 0 && evPos < 1) evItem.setAttribute("data-event-now", "");

        evItem.style.setProperty("--event-future", (evPos < 0) ? '1' : '0');
        if (evPos < 0) evItem.setAttribute("data-event-future", "");

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

  // ideally should be two functions,
  // one for building up the state,
  // one for constructing a 'dynamic' EventView.
  // Builds the state and provides a builder function for each event.
  function buildEventsView(viewJson: ViewJSON): EventsView {

    const title = viewJson["title"] || "Timetable View";

    const variables: Record<string, string> = viewJson["variables"];

    const replacers = (()=>{
      let replacersObj: Record<string, RegExpReplacer> = {};
      for (const replacerKey in viewJson["replacers"]) {
        replacersObj[replacerKey] = createRegExpReplacer(
          viewJson["replacers"][replacerKey]
          .map(([regexStringLiteral, replaceString])=>[
            createRegExpFromString(regexStringLiteral),
            replaceString
          ])
        );
      }
      return replacersObj;
    })();

    const shaders = (()=>{
      let shadersObj: Record<string, RegExpShader> = {};
      for (const shaderKey in viewJson["shaders"]) {
        const re = createRegExpFromString(viewJson["shaders"][shaderKey]);
        shadersObj[shaderKey] = createRegExpShader(re);
      }
      return shadersObj;
    })();

    // not really necessary at this level, remove for now
    // const shaderCache = new Map<string, RegExpMatchArray[]>();

    const viewsArrayScriptRuntime = new ViewScript.Runtime<ArticleState>({
      // a shader is a transform on a string, that when applied
      // bundles it up into an array of matches (for use with /.../g)
      // which each are of the format [wholeMatch: string, ...groups: string[]]
      // so ["shader", ...content..., "abc", 0, 1] gets "abc" shader's 0th match and 1st capturing group
      "shader"(state, args): Text {
        const inputText = args[0].textContent ?? "";
        const shaderKey = args[1].textContent ?? "";
        const matchNum = parseInt(args[2].textContent ?? "") || 0;
        const groupNum = parseInt(args[3].textContent ?? "") || 0;
        let element: Text;
        if (shaderKey in shaders) {
          const shaderResult = shaders[shaderKey](inputText);
          element = new Text(shaderResult[matchNum][groupNum]);
        }
        else {
          element = new Text();
        }
        return element;
      },
      // ["replace", ...content..., "abc"] replaces the content by applying the
      // array of rules [regex, replaceStr] in order (1st to last)
      "replace"(state, args): Text {
        const originalText = args[0].textContent ?? "";
        const replacerKey = args[1].textContent ?? "";
        let element: Text;
        if (replacerKey in replacers) {
          const replacerResult = replacers[replacerKey](originalText);
          element = new Text(replacerResult);
        }
        else {
          element = new Text();
        }
        return element;
      },
      // can currently only access variables, maybe implement postfix operators??
      "var"(state, args): Text {
        const varKey = args[0].textContent ?? "";
        let variableValue: string;
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
              variableValue = state.event.location
              break;
            }
            case "_event.duration": {
              const dur = state.event.duration;
              variableValue = `${dur.weeks}w${dur.days}d${dur.hours}h${dur.minutes}m${dur.seconds}s`;
              break;
            }
            case "_event.start": {
              const date = state.event.startDate.toJSDate();
              variableValue = `${localDateStr(date)} ${localTimeStr(date)}`;
              break;
            }
            case "_event.end": {
              const date = state.event.endDate.toJSDate();
              variableValue = `${localDateStr(date)} ${localTimeStr(date)}`;
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
      // all these functions put the content as the content of the respective element
      // (in future add ability for id and class)
      "<span>"(state, args): HTMLSpanElement {
        const element: HTMLSpanElement = document.createElement("span");
        element.append(args[0]);
        return element;
      },
      "<strong>"(state, args): HTMLElement {
        const element: HTMLElement = document.createElement("strong");
        element.append(args[0]);
        return element;
      },
      "<em>"(state, args): HTMLElement {
        const element: HTMLElement = document.createElement("em");
        element.append(args[0]);
        return element;
      },
      "<time>"(state, args): HTMLTimeElement {
        const element: HTMLTimeElement = document.createElement("time");
        element.append(args[0]);
        element.dateTime = args[0].textContent ?? "";
        return element;
      },
      "<abbr>"(state, args): HTMLElement {
        const element: HTMLElement = document.createElement("abbr");
        element.append(args[0]);
        return element;
      },
      "<b>"(state, args): HTMLElement {
        const element: HTMLElement = document.createElement("b");
        element.append(args[0]);
        return element;
      },
      "<i>"(state, args): HTMLElement {
        const element: HTMLElement = document.createElement("i");
        element.append(args[0]);
        return element;
      },
    });
  
    return {
      title, variables, replacers, shaders,
      buildArticle: (state: ArticleState) => {
        // <article> means that it can be removed from the document and make sense
        // it will become a child of `#events > li`
        const articleEle = document.createElement("article");
        // each member in ["article"] constitutes a whole ViewScript program
        // whose output becomes the content of each <p> in the <article>
        for (const line of viewJson["article"]) {
          const paragraph = document.createElement("p");
          paragraph.append(...viewsArrayScriptRuntime.execute(state, line));
          // find all URLs and replace them with hyperlinks
          findAndHref(paragraph);
          // the the line to the <article>
          articleEle.append(paragraph);
        }
        return articleEle;
      }
    } as EventsView;
  
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
      && TTV.elements.ttvViewSelect.reportValidity()
    ) {
      TTV.updateCalendarView({
        forDate: TTV.elements.eventsDateInput.valueAsDate!,
        icalHref: TTV.elements.icalUrlInput.value,
        viewId: TTV.elements.ttvViewSelect.value,
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
    TTV.elements.ttvViewSelect.value = viewId;
    checkValidInputsAndUpdate();
  }

});

window.addEventListener("error", errEv => {
  const reloadConfirmed = confirm("An error occured: " + errEv.error + ".\nWould you like to reset the site?");
  if (reloadConfirmed) {
    TTV.elements.ttvResetButton.click();
  }
});
