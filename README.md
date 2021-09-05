# timetable-view
A hobby project to better show my university timetable, and hopefully be extensible enough to apply elsewhere.

## Views Format
More documentation to come, but for now look at [views/uts.json](./views/uts.json) as an example.

### Article
Each member array is a `<p>` line in a timetable *event*. Each component of that member is either a string constant or a function that returns a string, and is concatenated together to form the `textContent` of each `<p>`.

### Article `["var", ...]` Variables
+ `"_event.start"`: en-AU locale string `dd/mm/yyyy, hh:mm:ss pm`
+ `"_event.end"`: en-AU locale string `dd/mm/yyyy, hh:mm:ss pm`
+ `"_event.duration"`: `0w0d0h0m0s`
+ `"_event.description"`: text
+ `"_event.location"`: text

### CSS `var(...)` Variables on `#events > li`
+ `--event-progress`: decimal values 0.0 to 1.0.

## Third-Party
+ `lib/ical.min.js`
  + Licensed under the [MPL-2.0 License](./LICENSE)
  + Source code available from https://github.com/mozilla-comm/ical.js
