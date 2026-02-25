import { assertExhaustive } from "@elyukai/utils/typeSafety"
import type { BlockMarkdownNode, BlockSyntaxMarkdownNode, DefinitionMarkerSyntaxNode, FootnoteMarkerSyntaxNode, HeadingMarkerSyntaxNode, ListItemMarkerSyntaxNode, SectionMarkerSyntaxNode, TableMarkerSyntaxNode } from "./block/node.ts"
import { blockRules, type BlockRule } from "./block/rules.ts"
import { textNode, type AttributedStringMarkdownNode, type BoldMarkdownNode, type CodeMarkdownNode, type FootnoteRefInlineNode, type InlineMarkdownNode, type ItalicMarkdownNode, type LinkMarkdownNode, type SuperscriptInlineNode, type TextNode } from "./inline/node.ts"
import { inlineRules, type InlineRule } from "./inline/rules.ts"

const parseForInlineRules = (
  rules: InlineRule[],
  text: string,
  forSyntaxHighlighting: boolean,
): InlineMarkdownNode[] => {
  if (text.length === 0 || rules[0] === undefined) {
    return []
  }

  const activeRule = rules[0]

  const res = activeRule.pattern.exec(text)
  if (res && (activeRule.predicate?.(res) ?? true)) {
    const { index } = res
    const before = text.slice(0, index)
    const after = text.slice(index + res[0].length)
    return [
      ...(before.length > 0
        ? parseForInlineRules(rules.slice(1), before, forSyntaxHighlighting)
        : []),
      (forSyntaxHighlighting ? activeRule.mapHighlighting : activeRule.map)(res, text =>
        parseForInlineRules(rules.slice(1), text, forSyntaxHighlighting),
      ),
      ...(after.length > 0 ? parseForInlineRules(rules, after, forSyntaxHighlighting) : []),
    ]
  } else {
    return parseForInlineRules(rules.slice(1), text, forSyntaxHighlighting)
  }
}

export const parseInlineMarkdown = (text: string): InlineMarkdownNode[] =>
  parseForInlineRules(inlineRules, text, false)

export const parseInlineMarkdownForSyntaxHighlighting = (text: string): InlineMarkdownNode[] =>
  reduceSyntaxNodes(parseForInlineRules(inlineRules, text, true))

export const syntaxNodeToString = (node: BlockSyntaxMarkdownNode): string => {
  switch (node.kind) {
    case "bold":
    case "italic":
    case "link":
    case "attributed":
    case "superscript":
      return node.content.map(syntaxNodeToString).join("")
    case "text":
    case "code":
    case "listItemMarker":
    case "tableMarker":
    case "headingMarker":
    case "sectionMarker":
    case "footnoteMarker":
    case "definitionMarker":
      return node.content
    case "footnoteRef":
      return node.label
    default:
      return assertExhaustive(node)
  }
}

const parseActiveBlockRule = (rule: BlockRule, res: RegExpExecArray): BlockMarkdownNode[] => [
  rule.map(res),
]

const parseActiveBlockSyntaxRule = (
  rule: BlockRule,
  res: RegExpExecArray,
): BlockSyntaxMarkdownNode[] => rule.mapHighlighting(res)

const leadingNewlinesPattern = /^((?:[ \t]*\n)*)/

const parseForBlockRules = <R>(
  rules: BlockRule[],
  text: string,
  ruleParser: (rule: BlockRule, res: RegExpExecArray) => R[],
  trimLeadingWhitespace?: true | ((text: string) => R[]),
  remainingRules: BlockRule[] = rules,
): R[] => {
  if (text.length === 0 || remainingRules[0] === undefined) {
    return []
  } else if (trimLeadingWhitespace === true) {
    return parseForBlockRules(
      rules,
      text.replace(leadingNewlinesPattern, ""),
      ruleParser,
      undefined,
      remainingRules,
    )
  } else if (trimLeadingWhitespace) {
    const matchedText = text.match(leadingNewlinesPattern)?.[0]
    return [
      ...(matchedText ? trimLeadingWhitespace(matchedText) : []),
      ...parseForBlockRules(
        rules,
        text.replace(leadingNewlinesPattern, ""),
        ruleParser,
        undefined,
        remainingRules,
      ),
    ]
  }

  const activeRule = remainingRules[0]
  const res = activeRule.pattern.exec(text)
  if (res && (activeRule.predicate?.(res) ?? true)) {
    const { index } = res
    const after = text.slice(index + res[0].length)
    return [
      ...ruleParser(activeRule, res),
      ...(after.length > 0 ? parseForBlockRules(rules, after, ruleParser) : []),
    ]
  } else {
    return parseForBlockRules(
      rules,
      text,
      ruleParser,
      trimLeadingWhitespace,
      remainingRules.slice(1),
    )
  }
}

type BlockSyntaxMarkdownNodeByKind = {
  bold: BoldMarkdownNode
  italic: ItalicMarkdownNode
  code: CodeMarkdownNode
  link: LinkMarkdownNode
  attributed: AttributedStringMarkdownNode
  footnoteRef: FootnoteRefInlineNode
  text: TextNode
  listItemMarker: ListItemMarkerSyntaxNode
  tableMarker: TableMarkerSyntaxNode
  headingMarker: HeadingMarkerSyntaxNode
  sectionMarker: SectionMarkerSyntaxNode
  footnoteMarker: FootnoteMarkerSyntaxNode
  superscript: SuperscriptInlineNode
  definitionMarker: DefinitionMarkerSyntaxNode
}

export const parseBlockMarkdown = (text: string): BlockMarkdownNode[] =>
  parseForBlockRules(blockRules, text, parseActiveBlockRule, true)

export const parseBlockMarkdownForSyntaxHighlighting = (text: string): BlockSyntaxMarkdownNode[] =>
  reduceSyntaxNodes(
    parseForBlockRules(blockRules, text, parseActiveBlockSyntaxRule, text => [textNode(text)]),
  )

export const reduceSyntaxNodes = <T extends BlockSyntaxMarkdownNode>(nodes: T[]): T[] =>
  nodes.reduce<T[]>((reducedNodes, node, index) => {
    const lastNode = index > 0 ? reducedNodes[reducedNodes.length - 1] : undefined
    const newLastNode = lastNode ? mergeSyntaxNodes(lastNode, node) : null

    if (newLastNode) {
      reducedNodes[reducedNodes.length - 1] = reduceSyntaxNode(newLastNode)
    } else {
      reducedNodes.push(reduceSyntaxNode(node))
    }
    return reducedNodes
  }, [])

type MergeFn<T> = <U extends T>(a: U, b: U) => U

const reduceSyntaxNode = <T extends BlockSyntaxMarkdownNode>(node: T): T => {
  switch (node.kind) {
    case "bold":
    case "italic":
    case "link":
    case "superscript":
      return { ...node, content: reduceSyntaxNodes(node.content) }
    case "code":
    case "attributed":
    case "text":
    case "listItemMarker":
    case "tableMarker":
    case "headingMarker":
    case "sectionMarker":
    case "footnoteMarker":
    case "footnoteRef":
    case "definitionMarker":
      return node
    default:
      return assertExhaustive(node)
  }
}

const syntaxNodeMergeRules: {
  [K in BlockSyntaxMarkdownNode["kind"]]: MergeFn<BlockSyntaxMarkdownNodeByKind[K]> | null
} = {
  bold: (a, b) => ({ ...a, content: [...a.content, ...b.content] }),
  italic: (a, b) => ({ ...a, content: [...a.content, ...b.content] }),
  code: (a, b) => ({ ...a, content: a.content + b.content }),
  text: (a, b) => ({ ...a, content: a.content + b.content }),
  listItemMarker: (a, b) => ({ ...a, content: a.content + b.content }),
  tableMarker: (a, b) => ({ ...a, content: a.content + b.content }),
  headingMarker: (a, b) => ({ ...a, content: a.content + b.content }),
  sectionMarker: (a, b) => ({ ...a, content: a.content + b.content }),
  footnoteMarker: (a, b) => ({ ...a, content: a.content + b.content }),
  superscript: (a, b) => ({ ...a, content: [...a.content, ...b.content] }),
  definitionMarker: (a, b) => ({ ...a, content: a.content + b.content }),
  footnoteRef: null,
  link: null,
  attributed: null,
}

const mergeSyntaxNodes = <T extends BlockSyntaxMarkdownNode>(lastNode: T, node: T) => {
  if (lastNode.kind !== node.kind) {
    return null
  }

  const mergeFn = syntaxNodeMergeRules[lastNode.kind] as MergeFn<T> | null
  return mergeFn?.(lastNode, node) ?? null
}
