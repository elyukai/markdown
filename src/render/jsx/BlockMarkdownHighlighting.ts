import type { BlockSyntaxMarkdownNode } from "../../block/node.ts"
import { InlineMarkdown } from "./InlineMarkdown.tsx"
import type { CreateElementFn, FunctionalComponent } from "./index.ts"

type Props = {
  node: BlockSyntaxMarkdownNode
  createElement: CreateElementFn
}

export const BlockMarkdownHighlighting: FunctionalComponent<Props> = ({
  node,
  createElement,
}: Props) => {
  switch (node.kind) {
    case "listItemMarker":
      return createElement("span", { className: "list-item-marker" }, node.content)
    case "tableMarker":
      return createElement("span", { className: "table-marker" }, node.content)
    case "headingMarker":
      return createElement("span", { className: "heading-marker" }, node.content)
    case "sectionMarker":
      return createElement("span", { className: "section-marker" }, node.content)
    case "footnoteMarker":
      return createElement("span", { className: "footnote-marker" }, node.content)
    case "footnoteRef":
      return createElement("span", { className: "footnote-marker" }, node.label)
    case "definitionMarker":
      return createElement("span", { className: "definition-description-marker" }, node.content)
    default:
      return createElement(InlineMarkdown, { node, createElement })
  }
}
