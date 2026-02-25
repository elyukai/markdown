import type { InlineMarkdownNode } from "../inline/node.ts"

export type ParagraphBlockNode = {
  kind: "paragraph"
  content: InlineMarkdownNode[]
}

export type HeadingBlockNode = {
  kind: "heading"
  level: number
  content: InlineMarkdownNode[]
}

export type ListBlockNode = {
  kind: "list"
  ordered: boolean
  content: ListItemNode[]
}

export type ListItemNode = {
  kind: "listItem"
  inlineLabel?: InlineMarkdownNode[]
  content: BlockMarkdownNode[]
}

export type TableBlockNode = {
  kind: "table"
  caption?: InlineMarkdownNode[]
  columns: TableColumnStyleBlockNode[]
  header: TableCellBlockNode[]
  rows: TableRowBlockNode[] | TableSectionBlockNode[]
}

export type TableColumnStyleBlockNode = {
  alignment?: "left" | "center" | "right"
}

export type TableSectionBlockNode = {
  kind: "tableSection"
  header?: TableCellBlockNode[]
  rows: TableRowBlockNode[]
}

export type TableRowBlockNode = {
  kind: "tableRow"
  cells: TableCellBlockNode[]
}

export type TableCellBlockNode = {
  kind: "tableCell"
  colSpan?: number
  content: InlineMarkdownNode[]
}

export type SectionBlockNode = {
  kind: "container"
  name?: string
  content: BlockMarkdownNode[]
}

export type FootnoteBlockNode = {
  kind: "footnote"
  label: string
  content: BlockMarkdownNode[]
}

export type DefinitionListBlockNode = {
  kind: "definitionList"
  content: DefinitionListItemBlockNode[]
}

export type DefinitionListItemBlockNode = {
  kind: "definitionListItem"
  terms: InlineMarkdownNode[][]
  definitions: BlockMarkdownNode[][]
}

export type BlockMarkdownNode =
  | ParagraphBlockNode
  | HeadingBlockNode
  | ListBlockNode
  | TableBlockNode
  | SectionBlockNode
  | FootnoteBlockNode
  | DefinitionListBlockNode

export type ListItemMarkerSyntaxNode = {
  kind: "listItemMarker"
  content: string
}

export type TableMarkerSyntaxNode = {
  kind: "tableMarker"
  content: string
}

export type HeadingMarkerSyntaxNode = {
  kind: "headingMarker"
  content: string
}

export type SectionMarkerSyntaxNode = {
  kind: "sectionMarker"
  content: string
}

export type FootnoteMarkerSyntaxNode = {
  kind: "footnoteMarker"
  content: string
}

export type DefinitionMarkerSyntaxNode = {
  kind: "definitionMarker"
  content: string
}

export type SyntaxNode =
  | ListItemMarkerSyntaxNode
  | TableMarkerSyntaxNode
  | HeadingMarkerSyntaxNode
  | SectionMarkerSyntaxNode
  | FootnoteMarkerSyntaxNode
  | DefinitionMarkerSyntaxNode

export type BlockSyntaxMarkdownNode = InlineMarkdownNode | SyntaxNode
