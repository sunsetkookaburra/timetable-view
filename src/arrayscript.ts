/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * Copyright (C) Oliver Lenehan, 2021 */

/** A language subset of JSON, using only arrays and primitives,
 * .... */
namespace ArrayScript {

  /** JSON primitive types. (JSON is the 'host' language) */
  export type SourceCodeValue = (string | number | boolean | null);
  /** Arrays are used as functions.
   * The first member is the function identifier,
   * and the rest are parameters. */
  export type SourceCodeFn = [id: string, ...args: (SourceCodeValue | SourceCodeFn)[]]
  export type SourceCodeProgram = (SourceCodeValue | SourceCodeFn)[];

  export type RuntimeFunction<State, Piece> = (state: State, args: Piece[]) => Piece;

  type EvalChunkResult<T, Ok extends boolean = boolean> = {
    ok: Ok,
    value: (Ok extends true ? undefined : T),
  };

  /** A ArrayScript (JSON array notation based language) 'compiler' and 'runtime'.
   * `<State>` is a type representing a value that can be passed into `Runtime.execute()`
   * that can provide either execution specific data or a mutable data store.
   * NO handling of source code errors YET. */
  export class Runtime<State, Piece> {

    private funcs = new Map<string, ArrayScript.RuntimeFunction<State, Piece>>();

    constructor(
      private foundation: (primitive: SourceCodeValue) => Piece,
    ) {}

    register(id: string, fn: ArrayScript.RuntimeFunction<State, Piece>) {
      this.funcs.set(id, fn);
    }
  
    execute(state: State, program: ArrayScript.SourceCodeProgram): Piece[] {
      const out: Piece[] = []
      for (const chunk of program) {
        const result: EvalChunkResult<Piece> = this.evalChunk(state, chunk);
        if (result.ok) out.push(result.value!);
      }
      return out;
    }

    private evalChunk(state: State, chunk: SourceCodeValue | SourceCodeFn): EvalChunkResult<Piece> {
      let value: Piece | undefined;
      let ok: boolean;
      // chunk == SourceCodeFn
      if (chunk instanceof Array) {
        // toString as a soft fallback
        const fnId: string = chunk[0].toString();
        const fn = this.funcs.get(fnId);
        if (fn !== undefined) {
          const args: Piece[] = [];
          for (const subchunk of chunk.slice(1)) {
            const arg = this.evalChunk(state, subchunk);
            if (arg.ok) args.push(arg.value!);
          }
          // console.log(args);
          value = fn(state, args);
          ok = true;
        }
        else {
          ok = false;
        }
      }
      // chunk != SourceCodeFn
      else {
        value = this.foundation(chunk);
        ok = true;
      }
      // console.log(value);
      return { ok, value };
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
