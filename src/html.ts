import parseAbbreviation from "@emmetio/abbreviation";
import resolveSnippets from "@emmetio/html-snippets-resolver";
import format from "@emmetio/markup-formatters";
import transform from "@emmetio/html-transform";
import htmlSnippet from "@emmetio/snippets/html.json";
import SnippetsRegistry from "@emmetio/snippets-registry";
import Profile from "@emmetio/output-profile";

import { checkMonacoExists, onCompletion, defaultOption } from "./helper";

const option = {
  ...defaultOption,
  snippets: new SnippetsRegistry(htmlSnippet),
  profile: new Profile()
};

function expand(abbr: string) {
  const tree = parseAbbreviation(abbr)
    .use(resolveSnippets, option.snippets)
    .use(transform, null, null);

  return format(tree, option.profile, option);
}

/**
 * almost the same behavior as VSCode's builtin emmet.
 * only triggered when string before text cursor(caret) matches emmet rules,
 * caret within html tag content area and suggest widget not visible,
 */
export default function emmetHTML(monaco = window.monaco) {
  if (!checkMonacoExists(monaco)) return;

  return onCompletion(
    monaco,
    "html",
    (tokens, index) =>
      tokens[index].type === "" &&
      (index === 0 || tokens[index - 1].type === "delimiter.html"),
    str => {
      // empty or ends with white space, illegal
      if (str === "" || str.match(/\s$/)) return;

      str = str.trim();

      // deal with white space, this determines how many characters needed to be emmeted
      // e.g. `a span div` => `a span <div></div>` skip `a span `
      // e.g. `a{111 222}` => `<a href="">111 222</a>`
      // conclusion: white spaces are only allowed between `[]` or `{}`
      // note: quotes also allowed white spaces, but quotes must in `[]` or `{}`, so skip it
      const step: { [key: string]: 1 | -1 } = {
        "{": 1,
        "}": -1,
        "[": 1,
        "]": -1
      };
      let pair = 0;

      for (let i = str.length - 1; i > 0; i--) {
        pair += step[str[i]] || 0;
        if (str[i].match(/\s/) && pair >= 0) {
          // illegal white space detected
          str = str.substr(i + 1);
          break;
        }
      }

      // starts with illegal character
      // note: emmet self allowed number element like `<1></1>`,
      // but obviously it's not fit with html standard, so skip it
      if (!str.match(/^[a-zA-Z[(.#]/)) return;

      // run expand to test the final result
      // `field` was used to set proper caret position after emmet
      try {
        return {
          emmetText: str,
          expandText: expand(str)
        };
      } catch {
        return;
      }
    }
  );
}
