export type TextNode = {
  kind: "text"
  content: string
}

export const textNode = (content: string): TextNode => ({
  kind: "text",
  content: content,
})

export type BoldMarkdownNode = {
  kind: "bold"
  content: InlineMarkdownNode[]
}

export type ItalicMarkdownNode = {
  kind: "italic"
  content: InlineMarkdownNode[]
}

export type CodeMarkdownNode = {
  kind: "code"
  content: string
}

export type LinkMarkdownNode = {
  kind: "link"
  href: string
  content: InlineMarkdownNode[]
}

export type AttributedStringMarkdownNode = {
  kind: "attributed"
  attributes: Record<string, string | number | boolean>
  content: InlineMarkdownNode[]
}

export type SuperscriptInlineNode = {
  kind: "superscript"
  content: InlineMarkdownNode[]
}

export type FootnoteRefInlineNode = {
  kind: "footnoteRef"
  label: string
}

export type InlineMarkdownNode =
  | BoldMarkdownNode
  | ItalicMarkdownNode
  | CodeMarkdownNode
  | LinkMarkdownNode
  | AttributedStringMarkdownNode
  | TextNode
  | SuperscriptInlineNode
  | FootnoteRefInlineNode
