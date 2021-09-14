/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */

function createHTMLElement(opt: {
  tag: string;
  id: string;
  class: string[];
  attr: Record<string, string>;
}) {
  const ele = document.createElement(opt.tag);
  ele.id = opt.id;
  ele.classList.add(...opt.class);
  const attrKeys = Object.keys(opt.attr);
  for (const attrKey of attrKeys) {
    ele.setAttribute(attrKey, opt.attr[attrKey]);
  }
  return ele;
}

// need a way to test for 'tainted' html strings
// to block disallowed tags / encode at top level or inside tag
namespace ViewScript {

  export type SourceCodeValue = (string | number | boolean | null); // inherited from JSON host
  export type SourceCodeFn = [id: string, ...args: (SourceCodeValue | SourceCodeFn)[]]
  export type SourceCodeProgram = (SourceCodeValue | SourceCodeFn)[];

  export type RuntimeFunction<State> = (state: State, args: (Element | Text)[]) => (Element | Text);

  // state is a mutable object that can be refered to for the duration of execute()
  // Node is likely either HTMLElement or Text, maybe i should be more specific in the type annotations
  export class Runtime<
    // so what exactly is state?
    // i think it should be unique to each run (can be mutated without issue)
    State,
    FnTable
      extends Record<string, ViewScript.RuntimeFunction<State>>
      = Record<string, ViewScript.RuntimeFunction<State>>
  > {

    constructor(private funcs: FnTable) {}

    private evalSourceCodePiece(state: State, piece: SourceCodeValue | SourceCodeFn): (Element | Text) {
      let node: (Element | Text);
      if (typeof piece != "object" || piece == null) {
        node = document.createTextNode((piece ?? "null").toString());
      } else {
        const fnId = piece[0];
        const fn = this.funcs[fnId] as FnTable[string] | undefined;
        node = fn?.(
          state,
          piece.slice(1)
            .map(v => this.evalSourceCodePiece(state, v))
          ) ?? document.createTextNode("");
      }
      return node;
    }
  
    execute(state: State, program: ViewScript.SourceCodeProgram): (Element | Text)[] {
      const outputNodes: (Element | Text)[] = []
      for (const piece of program) {
        const result: (Element | Text) = this.evalSourceCodePiece(state, piece);
        outputNodes.push(result);
      }
      return outputNodes;
    }

  }

}

// /** Text that has been safely HTML encoded. */
// type HTMLEncodedString = string & { __TYPE__: "HTMLEncodedString" };

// function encodeHTML(text: string): HTMLEncodedString {
//   text = text.replace(/&/g, "&amp;");
//   text = text.replace(/</g, "&lt;");
//   text = text.replace(/>/g, "&gt;");
//   text = text.replace(/"/g, "&quot;");
//   text = text.replace(/'/g, "&apos;");
//   return Object.assign(text, { __TYPE__: "HTMLEncodedString" as const });
// }
