import { isNotEmpty } from "@elyukai/utils/array/nonEmpty"
import { finalBlockMarkdown } from "./parser/block.ts"
import { inlineMarkdown } from "./parser/inline.ts"

/**
 * An error that occurs when there is an internal issue with the Markdown parser or renderer.
 */
export class InternalMarkdownError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InternalMarkdownError"
  }
}

/**
 * An error that occurs when there is a syntax error in the Markdown input.
 */
export class MarkdownSyntaxError extends SyntaxError {
  public row: number
  public column: number

  /**
   * The remaining text after the point where the syntax error was detected.
   */
  public remainingText: string

  constructor(row: number, column: number, remainingText: string) {
    super(
      `Unexpected Markdown syntax at row ${row.toFixed()}, column ${column.toFixed()}: ${remainingText}`,
    )
    this.name = "MarkdownSyntaxError"
    this.row = row
    this.column = column
    this.remainingText = remainingText
  }
}

const positionInStringToColumnAndRow = (
  position: number,
  string: string,
): { row: number; column: number } => {
  const lines = string.slice(0, position).split("\n")
  const row = lines.length
  const column = (lines.at(-1)?.length ?? 0) + 1
  return { row, column }
}

/**
 * Validates the given inline Markdown string and returns an error if there is a syntax issue.
 */
export const validateInline = (
  markdown: string,
): InternalMarkdownError | MarkdownSyntaxError | undefined => {
  const results = inlineMarkdown.evalT({ indentation: 0, keepSyntax: false }).parse(markdown)

  if (!isNotEmpty(results)) {
    return new InternalMarkdownError(`Failed to parse inline Markdown`)
  }

  const [_, remaining] = results[0]

  if (remaining.length > 0) {
    const { row, column } = positionInStringToColumnAndRow(
      markdown.length - remaining.length,
      markdown,
    )
    return new MarkdownSyntaxError(row, column, remaining)
  }

  return undefined
}

/**
 * Validates the given Markdown string and returns an error if there is a syntax issue.
 */
export const validate = (
  markdown: string,
): InternalMarkdownError | MarkdownSyntaxError | undefined => {
  const results = finalBlockMarkdown.evalT({ indentation: 0, keepSyntax: false }).parse(markdown)

  if (!isNotEmpty(results)) {
    return new InternalMarkdownError(`Failed to parse Markdown`)
  }

  const [_, remaining] = results[0]

  if (remaining.length > 0) {
    const { row, column } = positionInStringToColumnAndRow(
      markdown.length - remaining.length,
      markdown,
    )
    return new MarkdownSyntaxError(row, column, remaining)
  }

  return undefined
}
