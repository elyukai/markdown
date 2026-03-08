import { removeAt } from "@elyukai/utils/array/modify"
import { isNotEmpty, type NonEmptyArray } from "@elyukai/utils/array/nonEmpty"
import { Parser } from "@elyukai/utils/parser"
import { StateTParser as SParser } from "@elyukai/utils/stateParser"
import { isNaturalNumber } from "@elyukai/utils/string/regex"
import { assertExhaustive } from "@elyukai/utils/typeSafety"
import { reduceSyntaxNodes } from "../reduce.ts"
import { getSyntaxSetting, syntax, type S, type StatefulParser } from "./state.ts"

const defaultInlineSyntaxStartCharacters = ["*", "`", "[", "_", "{", "}", "|", "!", "^"]

export type Text = {
  type: "text"
  content: string
}

export type Code = {
  type: "code"
  content: string
}

export type FootnoteRef = {
  type: "footnoteRef"
  label: string | number

  /**
   * Equals the label as a string. Includes the full syntax when `keepSyntax` is true.
   */
  content: string
}

export type LeafContent = Code | Text | FootnoteRef

export type Bold = {
  type: "bold"
  content: InlineMarkdownNode[]
}

export type Italic = {
  type: "italic"
  content: InlineMarkdownNode[]
}

export type Superscript = {
  type: "superscript"
  content: InlineMarkdownNode[]
}

export type Link = {
  type: "link"
  href: string
  content: InlineMarkdownNode[]
}

export type Attributed = {
  type: "attributed"
  attributes: Record<string, string | number | boolean>
  content: InlineMarkdownNode[]
  rawAttributes?: [nameWithWhitespace: string, valueWithWhitespace: string][]
}

export type RecursiveContent = Attributed | Bold | Italic | Link | Superscript

export type InlineMarkdownNode = RecursiveContent | LeafContent

export const trimLastNodeEnd = (nodes: InlineMarkdownNode[]): InlineMarkdownNode[] => {
  const lastNode = nodes[nodes.length - 1]

  if (lastNode === undefined) {
    return nodes
  }

  switch (lastNode.type) {
    case "attributed":
    case "bold":
    case "italic":
    case "link":
    case "superscript":
      return [...nodes.slice(0, -1), { ...lastNode, content: trimLastNodeEnd(lastNode.content) }]
    case "code":
    case "footnoteRef":
      return nodes
    case "text":
      return [...nodes.slice(0, -1), { ...lastNode, content: lastNode.content.trimEnd() }]
    default:
      return assertExhaustive(lastNode)
  }
}

const anyStopOn = (
  charactersToStopOnIfNotEscaped: string[],
  nonEmpty = true,
): StatefulParser<string> =>
  SParser.lift(
    new Parser(syntax => {
      if (nonEmpty && (syntax.length === 0 || syntax.startsWith("\n"))) {
        return []
      }

      for (let i = 0; i < syntax.length; i++) {
        if (syntax[i] === "\\" && i + 1 < syntax.length && syntax[i + 1] !== "\n") {
          // skip next character because it's escaped
          i++
        } else if (
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          (syntax[i] !== "!" && charactersToStopOnIfNotEscaped.includes(syntax[i]!)) ||
          syntax[i] === "\n" ||
          (syntax[i] === "!" &&
            charactersToStopOnIfNotEscaped.includes("!") &&
            syntax[i + 1] === "[")
        ) {
          // const trimmed = syntax.slice(0, i).trimEnd()
          // if (i === 0 || (trimmed.length === 0 && nonEmpty)) {
          //   return []
          // }
          // return [[trimmed, syntax.slice(trimmed.length)]]
          return i === 0 ? [] : [[syntax.slice(0, i), syntax.slice(i)]]
        }
      }

      return [[syntax, ""]]
    }),
  )

const combineParsers = <T>(parsers: NonEmptyArray<StatefulParser<T>>): StatefulParser<T> =>
  parsers.reduce((acc, parser) => acc.orFirst(parser))

const parseEscapedCharacters = (text: string) => text.replace(/\\([*_`{}[\]()\\#+-.!^])/g, "$1")

const asText = (content: string): Text => ({ type: "text", content })

const text = (syntaxStartCharacters: string[]): StatefulParser<Text> =>
  anyStopOn(syntaxStartCharacters).then(result =>
    getSyntaxSetting.map(keepSyntax =>
      asText(keepSyntax ? result : parseEscapedCharacters(result)),
    ),
  )

const codeDelimiter = syntax(SParser.string<S>("`"))
const codeText = anyStopOn(["`"]).then(result => SParser.of(result.replace(/\\`/g, "`")))
const code: StatefulParser<Code> = codeDelimiter.then(start =>
  codeText.then(content =>
    codeDelimiter.map(end => ({ type: "code", content: (start ?? "") + content + (end ?? "") })),
  ),
)

export const footnoteRef: StatefulParser<FootnoteRef> = SParser.regex<S>(/^[a-zA-Z0-9]+/)
  .between(SParser.string("[^"), SParser.string("]"))
  .then(label =>
    getSyntaxSetting.map(keepSyntax => ({
      type: "footnoteRef",
      label: isNaturalNumber(label) ? Number.parseInt(label) : label,
      content: keepSyntax ? `[^${label}]` : label,
    })),
  )

const leafParsers = (
  syntaxStartCharacters: string[],
): NonEmptyArray<StatefulParser<LeafContent>> => [code, footnoteRef, text(syntaxStartCharacters)]

const leafParser = (syntaxStartCharacters: string[]) =>
  combineParsers(leafParsers(syntaxStartCharacters))

type RecursiveParser<T> = [
  (possibleContent: StatefulParser<InlineMarkdownNode>) => StatefulParser<T>,
  additionalSyntaxStartCharacters?: string[],

  /**
   * This needs to be the exact reference to the other array.
   */
  excludesAsContent?: RecursiveParser<unknown>[],
]

const uniformBetweenSyntax = <T extends string>(
  delimiter: StatefulParser<string>,
  type: T,
): RecursiveParser<{ type: T; content: InlineMarkdownNode[] }> => [
  possibleContent =>
    syntax(delimiter).then(start =>
      possibleContent.many1().then(content =>
        syntax(delimiter).then(end =>
          SParser.of({
            type,
            content:
              start !== undefined && end !== undefined
                ? reduceSyntaxNodes([asText(start), ...content, asText(end)])
                : content,
          }),
        ),
      ),
    ),
]

const boldDelimiter = SParser.string<S>("**")
const bold = uniformBetweenSyntax(boldDelimiter, "bold")

const italicDelimiter = SParser.string<S>("*")
const italic = uniformBetweenSyntax(italicDelimiter, "italic")

const superscriptDelimiter = SParser.string<S>("^")
const superscript = uniformBetweenSyntax(superscriptDelimiter, "superscript")

const linkStartDelimiter = syntax(SParser.string<S>("["))
const linkMiddleDelimiter = syntax(SParser.string<S>("]("))
const linkEndDelimiter = syntax(SParser.string<S>(")"))
const link: RecursiveParser<Link> = [
  possibleContent =>
    linkStartDelimiter.then(start =>
      possibleContent.many1().then(content =>
        linkMiddleDelimiter.then(middle =>
          anyStopOn([")"]).then(href =>
            linkEndDelimiter.then(end =>
              SParser.of({
                type: "link",
                href: href.trim(),
                content:
                  start !== undefined && middle !== undefined && end !== undefined
                    ? reduceSyntaxNodes([asText(start), ...content, asText(middle + href + end)])
                    : content,
              }),
            ),
          ),
        ),
      ),
    ),
  ["]"],
]

const attributedStartDelimiter = syntax(SParser.string<S>("^["))
const attributedMiddleDelimiter = syntax(SParser.string<S>("]("))
const attributedEndDelimiter = syntax(SParser.string<S>(")"))

const attributeStringValue = SParser.regex<S>(/^[^"]*/)
  .between(SParser.string('"'), SParser.string('"'))
  .map((value): [string, string] => ['"' + value + '"', value])
const attributeNumberValue = SParser.regex<S>(/^-?\d+(\.\d+)?/).map((value): [string, number] => [
  value,
  Number.parseFloat(value),
])
const attributeBooleanValue = SParser.regex<S>(/^(true|false)/).map((value): [string, boolean] => [
  value,
  value === "true",
])
type AttributeValuePair = [raw: string, parsed: string | number | boolean]
const attributeValue = SParser.hspace<S>().then(leading =>
  attributeBooleanValue
    .orFirstW(attributeNumberValue)
    .orFirstW(attributeStringValue)
    .then(([rawValue, value]) =>
      SParser.hspace<S>().map(
        (trailing): AttributeValuePair => [leading + rawValue + trailing, value],
      ),
    ),
)
const attributeName = SParser.regex<S>(/^ *\w+ */)

const attribute = attributeName.then(name =>
  SParser.string<S, ":">(":").then(() =>
    attributeValue.map((value): [string, AttributeValuePair] => [name, value]),
  ),
)
const attributes = attribute.separatedBy1(SParser.string(","))

const attributed: RecursiveParser<Attributed> = [
  possibleContent =>
    attributedStartDelimiter.then(start =>
      possibleContent.many1().then(content =>
        attributedMiddleDelimiter.then(middle =>
          attributes.then(attrs =>
            attributedEndDelimiter.then(end =>
              SParser.of({
                type: "attributed",
                attributes: Object.fromEntries(
                  attrs.map(([name, [_, value]]) => [name.trim(), value]),
                ),
                content:
                  start !== undefined && middle !== undefined && end !== undefined
                    ? reduceSyntaxNodes([
                        asText(start),
                        ...content,
                        asText(
                          middle +
                            attrs.map(([name, [rawValue]]) => name + ":" + rawValue).join(",") +
                            end,
                        ),
                      ])
                    : content,
              }),
            ),
          ),
        ),
      ),
    ),
  ["]"],
  [link],
]

const mapRecursiveParsers = (
  parsers: RecursiveParser<RecursiveContent>[],
  syntaxStartCharacters: string[],
): StatefulParser<RecursiveContent>[] =>
  parsers.map((parser, i, arr) => {
    const [createParser, additionalSyntaxStartCharacters = [], excludedParsers = []] = parser
    const newSyntaxStartCharacters = [...syntaxStartCharacters, ...additionalSyntaxStartCharacters]
    return createParser(
      combineParsers([
        ...mapRecursiveParsers(
          removeAt(arr, i).filter(
            p => !excludedParsers.includes(p) && (p[2] === undefined || !p[2].includes(parser)),
          ),
          newSyntaxStartCharacters,
        ),
        leafParser(newSyntaxStartCharacters),
      ] satisfies StatefulParser<InlineMarkdownNode>[] as NonEmptyArray<
        StatefulParser<InlineMarkdownNode>
      >),
    )
  })

const recursiveParsers: NonEmptyArray<RecursiveParser<RecursiveContent>> = [
  attributed,
  link,
  superscript,
  bold,
  italic,
]

export const inlineNode = combineParsers([
  ...mapRecursiveParsers(recursiveParsers, defaultInlineSyntaxStartCharacters),
  leafParser(defaultInlineSyntaxStartCharacters),
] satisfies StatefulParser<InlineMarkdownNode>[] as NonEmptyArray<
  StatefulParser<InlineMarkdownNode>
>)

export const inlineMarkdown: StatefulParser<InlineMarkdownNode[]> = inlineNode.many()

const _parseInlineMarkdown = (syntax: string, keepSyntax = false): InlineMarkdownNode[] => {
  const results = inlineMarkdown.evalT({ indentation: 0, keepSyntax }).parse(syntax)

  if (!isNotEmpty(results)) {
    throw new Error(`Failed to parse`)
  }

  const [result, remaining] = results[0]

  if (remaining.length > 0) {
    throw new Error(`Failed to parse the entire string. Remaining: "${remaining}"`)
  }

  return result
}

export const parseInlineMarkdown = (syntax: string): InlineMarkdownNode[] =>
  _parseInlineMarkdown(syntax, false)

export const parseInlineMarkdownForSyntaxHighlighting = (syntax: string): InlineMarkdownNode[] =>
  _parseInlineMarkdown(syntax, true)
