import { removeAt } from "@elyukai/utils/array/modify"
import { isNotEmpty, type NonEmptyArray } from "@elyukai/utils/array/nonEmpty"
import { Parser } from "@elyukai/utils/parser"
import { assertExhaustive } from "@elyukai/utils/typeSafety"

const defaultInlineSyntaxStartCharacters = ["*", "`", "[", "_", "{", "}", "|", "#", "!", "^"]

export type Text = { type: "text"; content: string }
export type Code = { type: "code"; content: Text }
export type FootnoteRef = { type: "footnoteRef"; label: string }

export type LeafContent = Code | Text | FootnoteRef

export type Bold = { type: "bold"; content: InlineMarkdownNode[] }
export type Italic = { type: "italic"; content: InlineMarkdownNode[] }
export type Superscript = { type: "superscript"; content: InlineMarkdownNode[] }
export type Link = { type: "link"; href: string; content: InlineMarkdownNode[] }
export type Attributed = {
  type: "attributed"
  attributes: Record<string, string | number | boolean>
  content: InlineMarkdownNode[]
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

const anyStopOn = (charactersToStopOnIfNotEscaped: string[], nonEmpty = true): Parser<string> =>
  new Parser(syntax => {
    if (nonEmpty && (syntax.length === 0 || syntax.startsWith("\n"))) {
      return []
    }

    for (let i = 0; i < syntax.length; i++) {
      if (syntax[i] === "\\" && i + 1 < syntax.length && syntax[i + 1] !== "\n") {
        // skip next character because it's escaped
        i++
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      } else if (charactersToStopOnIfNotEscaped.includes(syntax[i]!) || syntax[i] === "\n") {
        // const trimmed = syntax.slice(0, i).trimEnd()
        // if (i === 0 || (trimmed.length === 0 && nonEmpty)) {
        //   return []
        // }
        // return [[trimmed, syntax.slice(trimmed.length)]]
        return i === 0 ? [] : [[syntax.slice(0, i), syntax.slice(i)]]
      }
    }

    return [[syntax, ""]]
  })

const combineParsers = <T>(parsers: NonEmptyArray<Parser<T>>): Parser<T> =>
  parsers.reduce((acc, parser) => acc.orFirst(parser))

const parseEscapedCharacters = (text: string) => text.replace(/\\([*_`{}[\]()\\#+-.!^])/g, "$1")

const text = (syntaxStartCharacters: string[]): Parser<Text> =>
  anyStopOn(syntaxStartCharacters).then(result =>
    Parser.of({ type: "text", content: parseEscapedCharacters(result) }),
  )

const codeDelimiter = Parser.string("`")
const codeText = anyStopOn(["`"]).then(result =>
  Parser.of<Text>({ type: "text", content: result.replace(/\\`/g, "`") }),
)
const code: Parser<Code> = codeDelimiter.then(() =>
  codeText.then(content => codeDelimiter.then(() => Parser.of({ type: "code", content }))),
)

export const footnoteRef: Parser<FootnoteRef> = Parser.regex(/^[a-zA-Z0-9]+/)
  .between(Parser.string("[^"), Parser.string("]"))
  .then(label => Parser.of({ type: "footnoteRef", label }))

const leafParsers = (syntaxStartCharacters: string[]): NonEmptyArray<Parser<LeafContent>> => [
  code,
  footnoteRef,
  text(syntaxStartCharacters),
]

const leafParser = (syntaxStartCharacters: string[]) =>
  combineParsers(leafParsers(syntaxStartCharacters))

type RecursiveParser<T> = [
  (possibleContent: Parser<InlineMarkdownNode>) => Parser<T>,
  additionalSyntaxStartCharacters?: string[],

  /**
   * This needs to be the exact reference to the other array.
   */
  excludesAsContent?: RecursiveParser<unknown>[],
]

const uniformBetweenSyntax = <T extends string>(
  delimiter: Parser<string>,
  type: T,
): RecursiveParser<{ type: T; content: InlineMarkdownNode[] }> => [
  possibleContent =>
    delimiter.then(() =>
      possibleContent.many1().then(content => delimiter.then(() => Parser.of({ type, content }))),
    ),
]

const boldDelimiter = Parser.string("**")
const bold = uniformBetweenSyntax(boldDelimiter, "bold")

const italicDelimiter = Parser.string("*")
const italic = uniformBetweenSyntax(italicDelimiter, "italic")

const superscriptDelimiter = Parser.string("^")
const superscript = uniformBetweenSyntax(superscriptDelimiter, "superscript")

const linkStartDelimiter = Parser.string("[")
const linkMiddleDelimiter = Parser.string("](")
const linkEndDelimiter = Parser.string(")")
const link: RecursiveParser<Link> = [
  possibleContent =>
    linkStartDelimiter.then(() =>
      possibleContent
        .many1()
        .then(content =>
          linkMiddleDelimiter.then(() =>
            anyStopOn([")"]).then(href =>
              linkEndDelimiter.then(() => Parser.of({ type: "link", href, content })),
            ),
          ),
        ),
    ),
  ["]"],
]

const attributedStartDelimiter = Parser.string("^[")
const attributedMiddleDelimiter = Parser.string("](")
const attributedEndDelimiter = Parser.string(")")

const attributeStringValue = Parser.regex(/^[^"]*/)
  .between(Parser.string('"'), Parser.string('"'))
  .then(value => Parser.of(value))
const attributeNumberValue = Parser.regex(/^-?\d+(\.\d+)?/).map(Number.parseFloat)
const attributeBooleanValue = Parser.regex(/^(true|false)/).map(value => value === "true")
const attributeValue = attributeBooleanValue
  .orFirstW(attributeNumberValue)
  .orFirstW(attributeStringValue)
  .token()
const attributeName = Parser.regex(/^\w+/)

const attribute = attributeName.then(name =>
  Parser.symb(":").then(() =>
    attributeValue.then(value => Parser.of<[string, string | number | boolean]>([name, value])),
  ),
)
const attributes = attribute.separatedBy1(Parser.symb(","))

const attributed: RecursiveParser<Attributed> = [
  possibleContent =>
    attributedStartDelimiter.then(() =>
      possibleContent
        .many1()
        .then(content =>
          attributedMiddleDelimiter.then(() =>
            attributes.then(attrs =>
              attributedEndDelimiter.then(() =>
                Parser.of({ type: "attributed", attributes: Object.fromEntries(attrs), content }),
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
): Parser<RecursiveContent>[] =>
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
      ] satisfies Parser<InlineMarkdownNode>[] as NonEmptyArray<Parser<InlineMarkdownNode>>),
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
] satisfies Parser<InlineMarkdownNode>[] as NonEmptyArray<Parser<InlineMarkdownNode>>)

export const inlineMarkdown: Parser<InlineMarkdownNode[]> = inlineNode.many()

export const parseInlineMarkdown = (syntax: string): InlineMarkdownNode[] => {
  const results = inlineMarkdown.parse(syntax)

  if (!isNotEmpty(results)) {
    throw new Error(`Failed to parse`)
  }

  const [result, remaining] = results[0]

  if (remaining.length > 0) {
    throw new Error(`Failed to parse the entire string. Remaining: "${remaining}"`)
  }

  return result
}
