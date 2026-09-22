import { isNotEmpty } from "@elyukai/utils/array/nonEmpty"
import {
  checkTableRowsAreSections,
  finalBlockMarkdown,
  type BlockMarkdownNode,
} from "./parser/block.ts"
import { inlineMarkdown, type Attributed, type InlineMarkdownNode } from "./parser/inline.ts"
import {
  passThroughInnerFlat,
  render,
  renderInline,
  type BlockBuilderMap,
  type InlineBuilderMap,
} from "./render/builder.ts"

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

export type ValidationOptions = {
  validateAttributes?: (attributes: Attributed["attributes"]) => Error[]
}

const emptyErrors = (): Error[] => []

const inlineValidationMap: InlineBuilderMap<Error[], [options?: ValidationOptions]> = {
  attributed: (node, validateInner, options) =>
    passThroughInnerFlat(node, validateInner, options).concat(
      options?.validateAttributes?.(node.attributes) ?? [],
    ),
  bold: passThroughInnerFlat,
  italic: passThroughInnerFlat,
  link: passThroughInnerFlat,
  superscript: passThroughInnerFlat,
  code: emptyErrors,
  footnoteRef: emptyErrors,
  text: emptyErrors,
}

const collectInlineValidationErrors = (nodes: InlineMarkdownNode[], options?: ValidationOptions) =>
  nodes.flatMap(node => renderInline(node, inlineValidationMap, options))

const blockValidationMap: BlockBuilderMap<Error[], Error[], [options?: ValidationOptions]> = {
  container: (node, validateInner, _validateInnerInline, options) =>
    node.content.flatMap(content => validateInner(content, options)),
  definitionList: (node, validateInner, validateInnerInline, options) =>
    node.content.flatMap(itemGroup => [
      ...itemGroup.terms.flatMap(term =>
        term.flatMap(content => validateInnerInline(content, options)),
      ),
      ...itemGroup.descriptions.flatMap(description =>
        description.flatMap(content => validateInner(content, options)),
      ),
    ]),
  footnote: (node, validateInner, _validateInnerInline, options) =>
    node.content.flatMap(content => validateInner(content, options)),
  heading: (node, _validateInner, validateInnerInline, options) =>
    node.content.flatMap(content => validateInnerInline(content, options)),
  list: (node, validateInner, _validateInnerInline, options) =>
    node.content.flatMap(item => item.content.flatMap(content => validateInner(content, options))),
  paragraph: (node, _validateInner, validateInnerInline, options) =>
    node.content.flatMap(content =>
      content.type === "break" ? [] : validateInnerInline(content, options),
    ),
  table: (node, _validateInner, validateInnerInline, options) => [
    ...(node.caption?.flatMap(captionLine =>
      captionLine.flatMap(content => validateInnerInline(content, options)),
    ) ?? []),
    ...node.header.flatMap(cell =>
      cell.content.flatMap(content => validateInnerInline(content, options)),
    ),
    ...(checkTableRowsAreSections(node.rows)
      ? node.rows.flatMap(section => [
          ...(section.header?.flatMap(cell =>
            cell.content.flatMap(content => validateInnerInline(content, options)),
          ) ?? []),
          ...section.rows.flatMap(row =>
            row.cells.flatMap(cell =>
              cell.content.flatMap(content => validateInnerInline(content, options)),
            ),
          ),
        ])
      : node.rows.flatMap(row =>
          row.cells.flatMap(cell =>
            cell.content.flatMap(content => validateInnerInline(content, options)),
          ),
        )),
  ],
}

const validationMap = { ...inlineValidationMap, ...blockValidationMap }

const collectBlockValidationErrors = (nodes: BlockMarkdownNode[], options?: ValidationOptions) =>
  nodes.flatMap(node => render(node, validationMap, options))

/**
 * Validates the given inline Markdown string and returns an error if there is a syntax issue.
 */
export const validateInline = (
  markdown: string,
  options?: ValidationOptions,
): (InternalMarkdownError | MarkdownSyntaxError | Error)[] => {
  const results = inlineMarkdown
    .evalT({ indentation: 0, keepSyntax: false, preserveEscapes: false })
    .parse(markdown)

  if (!isNotEmpty(results)) {
    return [new InternalMarkdownError(`Failed to parse inline Markdown`)]
  }

  const [nodes, remaining] = results[0]

  if (remaining.length > 0) {
    const { row, column } = positionInStringToColumnAndRow(
      markdown.length - remaining.length,
      markdown,
    )
    return [new MarkdownSyntaxError(row, column, remaining)]
  }

  if (options?.validateAttributes !== undefined) {
    return collectInlineValidationErrors(nodes, options)
  }

  return []
}

/**
 * Validates the given Markdown string and returns an error if there is a syntax issue.
 */
export const validate = (
  markdown: string,
  options?: ValidationOptions,
): (InternalMarkdownError | MarkdownSyntaxError | Error)[] => {
  const results = finalBlockMarkdown
    .evalT({ indentation: 0, keepSyntax: false, preserveEscapes: false })
    .parse(markdown)

  if (!isNotEmpty(results) || (results[0][0] === undefined && markdown.length > 0)) {
    return [new InternalMarkdownError(`Failed to parse Markdown`)]
  }

  const [nodes = [], remaining] = results[0]

  if (remaining.length > 0) {
    const { row, column } = positionInStringToColumnAndRow(
      markdown.length - remaining.length,
      markdown,
    )
    return [new MarkdownSyntaxError(row, column, remaining)]
  }

  if (options?.validateAttributes !== undefined) {
    return collectBlockValidationErrors(nodes, options)
  }

  return []
}
