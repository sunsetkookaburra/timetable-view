/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */

// https://codemix.com/opaque-types-in-javascript/
type Opaque<K, T> = T & { __TYPE__: K };

/** A string like `"/abc/gi"` */
type RegexLiteralString = Opaque<"RegexLiteralString", string>;

/** A string like `"Hello, $1"` */
type RegexReplaceString = Opaque<"RegexReplaceString", string>;

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
  + "-" + padStart(date.getDate().toString(), 2, '0');
}

/** `0h:0m:0s` */
function localTimeStr(date: Date) {
  return padStart(date.getHours().toString(), 2, '0')
  + ":" + padStart(date.getMinutes().toString(), 2, '0')
  + ":" + padStart(date.getSeconds().toString(), 2, '0');
}

/** Take a string in the form `"/Hello/i"` and create a new `RegExp`. */
function createRegExpFromString(literal: RegexLiteralString): RegExp {
  
  const lastSlash = literal.lastIndexOf("/");

  const re = new RegExp(
    literal.slice(1, lastSlash),
    literal.slice(lastSlash+1)
  );

  return re;

}

type RegExpShader = (input: string) => RegExpExecArray[];

function createRegExpShader(re: RegExp): RegExpShader {

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

type RegExpReplacer = (input: string) => string;

/** Given an array of `[RegExp, RegExp_replacerString]` pairs,
 * returns a function that transforms a string input by applying the 'rules' in the array in order. */
function createRegExpReplacer(replacerRules: [RegExp, string][]): RegExpReplacer {

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

function findAndHref(root: Node) {
  // recurse children
  // do not follow down <a>
  // replace text node with before + <a> + after
  for (const node of root.childNodes) {
    if (node.nodeName == "#text") {
      const re = /https?:\/\/[^ ]+/;
      const text = node.textContent ?? "";
      const match = re.exec(text);
      if (match != null) {
        const front = text.slice(0, match.index);
        const back = text.slice(match.index + match[0].length);
        const anchor = document.createElement("a");
        const url = new URL(match[0]);
        anchor.href = url.href;
        anchor.textContent = url.hostname;
        node.parentNode?.insertBefore(document.createTextNode(front), node);
        node.parentNode?.insertBefore(anchor, node);
        node.parentNode?.insertBefore(document.createTextNode(back), node);
        node.remove();
      }
    }
    else if (node.nodeName != "A") {
      findAndHref(node);
    }
  }
}
