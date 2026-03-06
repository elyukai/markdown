import { assertExhaustive } from "@elyukai/utils/typeSafety"
import type { BlockMarkdownSyntaxNode } from "./parser/block.ts"

export {
  parseInlineMarkdown,
  parseInlineMarkdownForSyntaxHighlighting,
  type Attributed,
  type Bold,
  type Code,
  type FootnoteRef,
  type InlineMarkdownNode,
  type Italic,
  type LeafContent,
  type Link,
  type RecursiveContent,
  type Superscript,
  type Text,
} from "./parser/inline.ts"

export {
  checkTableRowsAreSections,
  parseBlockMarkdown,
  parseBlockMarkdownForSyntaxHighlighting,
  type BlockMarkdownNode,
  type BlockMarkdownSyntaxNode,
  type Break,
  type Container,
  type DefinitionList,
  type DefinitionListItem,
  type Footnote,
  type Heading,
  type List,
  type ListItem,
  type Paragraph,
  type ParagraphContent,
  type Syntax,
  type Table,
  type TableCell,
  type TableColumnStyle,
  type TableRow,
  type TableSection,
} from "./parser/block.ts"

export const syntaxNodeToString = (node: BlockMarkdownSyntaxNode): string => {
  switch (node.type) {
    case "bold":
    case "italic":
    case "link":
    case "attributed":
    case "superscript":
      return node.content.map(syntaxNodeToString).join("")
    case "text":
    case "code":
    case "syntax":
    case "footnoteRef":
      return node.content
    default:
      return assertExhaustive(node)
  }
}
