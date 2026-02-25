import { textNode, type InlineMarkdownNode } from "./node.ts"

export type InlineRule = {
  pattern: RegExp
  predicate?: (result: RegExpExecArray) => boolean
  map: (
    result: RegExpExecArray,
    parseInside: (text: string) => InlineMarkdownNode[],
  ) => InlineMarkdownNode
  mapHighlighting: (
    result: RegExpExecArray,
    parseInside: (text: string) => InlineMarkdownNode[],
  ) => InlineMarkdownNode
}

const codeRule: InlineRule = {
  pattern: /`(.*?)`/,
  map: result => ({
    kind: "code",
    content: result[1] ?? "",
  }),
  mapHighlighting: result => ({
    kind: "code",
    content: `\`${result[1] ?? ""}\``,
  }),
}

const boldWithItalicRule: InlineRule = {
  pattern: /(?<!\\|\*\*.*)\*\*(([^\\*]*)?\*(?!\*).*?[^\\*]\*.*?)(?<!\\)\*\*/,
  map: (result, parseInside) => ({
    kind: "bold",
    content: parseInside(result[1] ?? ""),
  }),
  mapHighlighting: (result, parseInside) => ({
    kind: "bold",
    content: [textNode("**"), ...parseInside(result[1] ?? ""), textNode("**")],
  }),
}

const italicWithBoldRule: InlineRule = {
  pattern:
    /(?<![\\*]|[^\\]\*.*)\*(?=\*\*|[^*])([^*]*?\*\*[^*]*?\*\*[^*]*?)(?<=[^\\*]|[^\\]\*\*)\*(?!\*)/,
  map: (result, parseInside) => ({
    kind: "italic",
    content: parseInside(result[1] ?? ""),
  }),
  mapHighlighting: (result, parseInside) => ({
    kind: "italic",
    content: [textNode("*"), ...parseInside(result[1] ?? ""), textNode("*")],
  }),
}

const boldRule: InlineRule = {
  pattern: /(?<!\\)\*\*(.*?[^\\*])\*\*/,
  map: (result, parseInside) => ({
    kind: "bold",
    content: parseInside(result[1] ?? ""),
  }),
  mapHighlighting: (result, parseInside) => ({
    kind: "bold",
    content: [textNode("**"), ...parseInside(result[1] ?? ""), textNode("**")],
  }),
}

const italicRule: InlineRule = {
  pattern: /(?<!\\)\*(.*?[^\\*])\*/,
  map: (result, parseInside) => ({
    kind: "italic",
    content: parseInside(result[1] ?? ""),
  }),
  mapHighlighting: (result, parseInside) => ({
    kind: "italic",
    content: [textNode("*"), ...parseInside(result[1] ?? ""), textNode("*")],
  }),
}

const linkRule: InlineRule = {
  pattern: /(?<![\\^])\[(.*?[^\\])\]\((.*?[^\\])\)/,
  map: (result, parseInside) => ({
    kind: "link",
    href: result[2] ?? "",
    content: parseInside(result[1] ?? ""),
  }),
  mapHighlighting: (result, parseInside) => ({
    kind: "link",
    href: result[2] ?? "",
    content: [textNode("["), ...parseInside(result[1] ?? ""), textNode(`](${result[2] ?? ""})`)],
  }),
}

const booleanAttributePattern = /^(true|false)/
const numberAttributePattern = /^(-?\d+(\.\d+)?)/
const stringAttributePattern = /^("(.*?)(?<!\\)"|'(.*?)(?<!\\)')/

const parseAttributeValue = (text: string): [string | number | boolean, string] | null => {
  const booleanResult = booleanAttributePattern.exec(text)
  if (booleanResult !== null) {
    return [booleanResult[1] === "true", booleanResult[0]]
  }

  const numberResult = numberAttributePattern.exec(text)
  if (numberResult !== null) {
    return [Number.parseFloat(numberResult[1] ?? "0"), numberResult[0]]
  }

  const stringResult = stringAttributePattern.exec(text)
  if (stringResult !== null) {
    return [stringResult[2] ?? stringResult[3] ?? "", stringResult[0]]
  }

  return null
}

const attributeNamePattern = /^(\w+)(: *)/
const attributeSeparatorPattern = /^,( *)/

type RawAttribute =
  | string
  | { name: string; separator: string; value: string | number | boolean; rawValue: string }

const parseNextAttributes = (text: string): RawAttribute[] => {
  const separatorResult = attributeSeparatorPattern.exec(text)
  if (separatorResult === null) {
    return []
  }

  const remainingText = text.slice(separatorResult[0].length)

  return [separatorResult[0], ...parseAttributes(remainingText)]
}

const parseAttributes = (text: string): RawAttribute[] => {
  const nameResult = attributeNamePattern.exec(text)

  if (nameResult === null) {
    return []
  }

  const name = nameResult[1] ?? ""
  const separator = nameResult[2] ?? ""

  const remainingText = text.slice(nameResult[0].length)
  const valueResult = parseAttributeValue(remainingText)

  if (valueResult === null) {
    return []
  }

  const [value, rawValue] = valueResult

  return [
    { name, separator, value, rawValue },
    ...parseNextAttributes(remainingText.slice(rawValue.length)),
  ]
}

const mapAttributesToObject = (
  rawAttributes: RawAttribute[],
): Record<string, string | number | boolean> =>
  Object.fromEntries(
    rawAttributes.filter(attr => typeof attr !== "string").map(attr => [attr.name, attr.value]),
  )

const mapAttributesToNodes = (rawAttributes: RawAttribute[]): InlineMarkdownNode[] =>
  rawAttributes.flatMap(attr =>
    typeof attr === "string"
      ? [textNode(attr)]
      : [textNode(attr.name), textNode(attr.separator), textNode(attr.rawValue)],
  )

const parsedAttributesLength = (rawAttributes: RawAttribute[]): number =>
  rawAttributes.reduce(
    (sum, attr) =>
      sum +
      (typeof attr === "string"
        ? attr.length
        : attr.name.length + attr.separator.length + attr.rawValue.length),
    0,
  )

const attributedRule: InlineRule = {
  pattern:
    /(?<!\\)\^\[(.*?[^\\])\]\(((?:\w+: *(?:true|false|\d+(?:\.\d+)?|"(.*?)(?<!\\)"|'(.*?)(?<!\\)'))(?:, *\w+: *(?:true|false|\d+(?:\.\d+)?|"(.*?)(?<!\\)"|'(.*?)(?<!\\)'))*)\)/,
  map: ([_res, content = "", attributesText = ""], parseInside) => ({
    kind: "attributed",
    attributes: mapAttributesToObject(parseAttributes(attributesText)),
    content: parseInside(content),
  }),
  mapHighlighting: ([_res, content = "", attributesText = ""], parseInside) => {
    const attributes = parseAttributes(attributesText)
    const length = parsedAttributesLength(attributes)
    const unparsedText: InlineMarkdownNode[] =
      attributesText.length > length
        ? [{ kind: "text", content: attributesText.slice(length) }]
        : []
    return {
      kind: "attributed",
      attributes: mapAttributesToObject(attributes),
      content: [
        textNode("^["),
        ...parseInside(content),
        textNode("]("),
        ...mapAttributesToNodes(attributes),
        ...unparsedText,
        textNode(")"),
      ],
    }
  },
}

const superscriptRule: InlineRule = {
  pattern: /\^(.*?)\^/,
  map: (result, parseInside) => ({
    kind: "superscript",
    content: parseInside(result[1] ?? ""),
  }),
  mapHighlighting: (result, parseInside) => ({
    kind: "superscript",
    content: [textNode("^"), ...parseInside(result[1] ?? ""), textNode("^")],
  }),
}

const footnoteRefRule: InlineRule = {
  pattern: /(?<!\\)\[\^([a-zA-Z0-9*]+?)\]/,
  map: ([_match, label = ""]) => ({
    kind: "footnoteRef",
    label,
  }),
  mapHighlighting: ([match]) => ({
    kind: "footnoteRef",
    label: match,
  }),
}

const parseEscapedCharacters = (text: string) => text.replace(/\\([*_`[\]()\\])/g, "$1")

const textRule: InlineRule = {
  pattern: /.+/s,
  map: result => ({
    kind: "text",
    content: parseEscapedCharacters(result[0]),
  }),
  mapHighlighting: result => ({
    kind: "text",
    content: result[0],
  }),
}

export const inlineRules: InlineRule[] = [
  codeRule,
  linkRule,
  attributedRule,
  boldWithItalicRule,
  italicWithBoldRule,
  boldRule,
  italicRule,
  superscriptRule,
  footnoteRefRule,
  textRule,
]
