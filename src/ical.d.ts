
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

  class Time {
    static now(): ICAL.Time;
    static fromJSDate(date: Date, utsUTC?: boolean): ICAL.Time;
    constructor(data: {
      year?: number,
      month?: number,
      day?: number,
      hour?: number,
      minute?: number,
      second?: number,
      isDate?: boolean,
    });
    toJSDate(): Date;
    compare(aOther: ICAL.Time): -1 | 0 | 1;
    dayOfYear(): number;
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
