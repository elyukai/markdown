import type { InlineMarkdownNode } from "../parser/inline.ts"
import { renderInline, type InlineBuilderMap } from "./builder.ts"

const buildInners = (
  node: { content: InlineMarkdownNode[] },
  parseInner: (node: InlineMarkdownNode) => string,
): string => node.content.map(content => parseInner(content)).join("")

const inlineBuilder: InlineBuilderMap<string, []> = {
  bold: buildInners,
  italic: buildInners,
  code: node => node.content,
  link: buildInners,
  attributed: buildInners,
  text: node => node.content,
  superscript: buildInners,
  footnoteRef: node => node.label.toString(),
}

/**
 * Strips inline markdown syntax from a string, returning only the text content.
 */
export const stripInlineMarkdown = (markdown: string): string =>
  renderInline(markdown, inlineBuilder).join("")
