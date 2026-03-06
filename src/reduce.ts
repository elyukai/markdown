import { assertExhaustive } from "@elyukai/utils/typeSafety"
import type { Break, Syntax } from "./parser/block.ts"
import type {
  Attributed,
  Bold,
  Code,
  FootnoteRef,
  InlineMarkdownNode,
  Italic,
  Link,
  Superscript,
  Text,
} from "./parser/inline.ts"

type InlineSyntaxNodeByKind = {
  bold: Bold
  italic: Italic
  code: Code
  link: Link
  attributed: Attributed
  footnoteRef: FootnoteRef
  text: Text
  superscript: Superscript
  break: Break
  syntax: Syntax
}

export const reduceSyntaxNodes = <T extends InlineMarkdownNode | Break | Syntax>(nodes: T[]): T[] =>
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

const reduceSyntaxNode = <T extends InlineMarkdownNode | Break | Syntax>(node: T): T => {
  switch (node.type) {
    case "bold":
    case "italic":
    case "link":
    case "superscript":
      return { ...node, content: reduceSyntaxNodes(node.content) }
    case "code":
    case "attributed":
    case "text":
    case "footnoteRef":
    case "break":
    case "syntax":
      return node
    default:
      return assertExhaustive(node)
  }
}

const syntaxNodeMergeRules: {
  [K in (InlineMarkdownNode | Break | Syntax)["type"]]: MergeFn<InlineSyntaxNodeByKind[K]> | null
} = {
  bold: (a, b) => ({ ...a, content: [...a.content, ...b.content] }),
  italic: (a, b) => ({ ...a, content: [...a.content, ...b.content] }),
  superscript: (a, b) => ({ ...a, content: [...a.content, ...b.content] }),
  code: null,
  text: (a, b) => ({ ...a, content: a.content + b.content }),
  // only merges adjacent syntax nodes if they have the same blockType
  syntax: (a, b) => ({ ...a, content: a.content + b.content }),
  footnoteRef: null,
  link: null,
  attributed: null,
  break: null,
}

const mergeSyntaxNodes = <T extends InlineMarkdownNode | Break | Syntax>(lastNode: T, node: T) => {
  if (
    lastNode.type !== node.type ||
    (lastNode.type === "syntax" && node.type === "syntax" && lastNode.blockType !== node.blockType)
  ) {
    return null
  }

  const mergeFn = syntaxNodeMergeRules[lastNode.type] as MergeFn<T> | null
  return mergeFn?.(lastNode, node) ?? null
}

export const removeEmptySyntaxNodes = <T extends InlineMarkdownNode | Break | Syntax>(
  nodes: T[],
): T[] =>
  nodes
    .map(node =>
      "content" in node && Array.isArray(node.content)
        ? { ...node, content: removeEmptySyntaxNodes(node.content) }
        : node,
    )
    .filter(node => !("content" in node) || node.content.length > 0)
