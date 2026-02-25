import { assertExhaustive } from "@elyukai/utils/typeSafety"
import type { InlineMarkdownNode } from "../../inline/node.ts"
import type { CreateElementFn, FunctionalComponent } from "./index.ts"
// import { Fragment, type FunctionalComponent } from "preact"

type Props = {
  node: InlineMarkdownNode
  createElement: CreateElementFn
}

const emptyNode: InlineMarkdownNode = { kind: "text", content: "" }

export const InlineMarkdown: FunctionalComponent<Props> = ({ node, createElement }) => {
  switch (node.kind) {
    case "code":
      return createElement("code", null, node.content)
    case "bold":
      return createElement(
        "strong",
        null,
        ...node.content.map((inline, i) =>
          createElement(InlineMarkdown, { key: i, node: inline, createElement }),
        ),
      )
    case "italic":
      return createElement(
        "em",
        null,
        ...node.content.map((inline, i) =>
          createElement(InlineMarkdown, { key: i, node: inline, createElement }),
        ),
      )
    case "link":
      return createElement(
        "a",
        { href: node.href },
        ...node.content.map((inline, i) =>
          createElement(InlineMarkdown, { key: i, node: inline, createElement }),
        ),
      )
    case "attributed": {
      const separatorIndex = node.content.findIndex(
        attr => attr.kind === "text" && attr.content === "](",
      )
      const count = Object.keys(node.attributes).length

      const attributesStart = separatorIndex + 1
      const attributesEnd = attributesStart + (count === 0 ? 0 : count * 4 - 1)

      const leadingNodes = node.content.slice(0, attributesStart)
      const attributes = node.content.slice(attributesStart, attributesEnd)
      const trailingNodes = node.content.slice(attributesEnd)

      return createElement(
        "span",
        {
          className: "attributed",
          ...Object.fromEntries(
            Object.entries(node.attributes).map(([k, v]) => [`data-${k}`, v.toString()]),
          ),
        },
        ...leadingNodes.map((inline, i) =>
          createElement(InlineMarkdown, { key: i, node: inline, createElement }),
        ),
        ...Array.from({ length: count }, (_, i) => [
          createElement(
            "span",
            { className: "attributed__name", key: `attr-name-${(i + 1).toString()}` },
            createElement(InlineMarkdown, { node: attributes[i * 4] ?? emptyNode, createElement }),
          ),
          createElement(
            "span",
            { className: "attributed__separator", key: `attr-sep-${(i + 1).toString()}` },
            createElement(InlineMarkdown, {
              node: attributes[i * 4 + 1] ?? emptyNode,
              createElement,
            }),
          ),
          createElement(
            "span",
            { className: "attributed__value", key: `attr-value-${(i + 1).toString()}` },
            createElement(InlineMarkdown, {
              node: attributes[i * 4 + 2] ?? emptyNode,
              createElement,
            }),
          ),
          i < count - 1 &&
            createElement(
              "span",
              { className: "attributed__separator", key: `attr-sep2-${(i + 1).toString()}` },
              createElement(InlineMarkdown, {
                node: attributes[i * 4 + 3] ?? emptyNode,
                createElement,
              }),
            ),
        ]).flat(),
        ...trailingNodes.map((inline, i) =>
          createElement(InlineMarkdown, { key: i, node: inline, createElement }),
        ),
      )
    }
    case "superscript":
      return createElement(
        "sup",
        null,
        ...node.content.map((inline, i) =>
          createElement(InlineMarkdown, { key: i, node: inline, createElement }),
        ),
      )
    case "footnoteRef": {
      const isNumeric = /^\d+$/.test(node.label)
      return createElement(
        "sup",
        {
          className: "footnote-ref" + (isNumeric ? " footnote-ref--numeric" : ""),
          "data-reference": node.label,
          style: { "--label": isNumeric ? Number.parseInt(node.label) : node.label } as Record<
            string,
            string | number
          >,
        },
        createElement("span", { className: "footnote-label" }, node.label),
      )
    }
    case "text":
      return node.content
    default:
      return assertExhaustive(node)
  }
}
