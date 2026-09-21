import { sum } from "@elyukai/utils/array/reductions"
import {
  checkTableRowsAreSections,
  type BlockMarkdownNode,
  type Table,
  type TableCell,
} from "../parser/block.ts"
import type { InlineMarkdownNode } from "../parser/inline.ts"
import {
  render,
  renderFromString,
  renderInline,
  renderInlineFromString,
  type BlockBuilderMap,
  type InlineBuilderMap,
} from "./builder.ts"

export type FormatterOptions = {
  alignTableDividers: boolean
}

const defaultOptions: FormatterOptions = {
  alignTableDividers: false,
}

type BlockEnv = {
  nesting: number
}

const defaultBlockEnv: BlockEnv = {
  nesting: 0,
}

const inlineBuilderMap: InlineBuilderMap<string, [options: FormatterOptions, env: BlockEnv]> = {
  bold: (node, formatInner, options, env) =>
    "**" + node.content.map(childNode => formatInner(childNode, options, env)).join("") + "**",
  italic: (node, formatInner, options, env) =>
    "*" + node.content.map(childNode => formatInner(childNode, options, env)).join("") + "*",
  code: node => "`" + node.content.replaceAll("`", "\\`") + "`",
  link: (node, formatInner, options, env) =>
    "[" +
    node.content.map(childNode => formatInner(childNode, options, env)).join("") +
    "](" +
    node.href +
    ")",
  attributed: (node, formatInner, options, env) =>
    "^[" +
    node.content.map(childNode => formatInner(childNode, options, env)).join("") +
    "](" +
    Object.entries(node.attributes)
      .map(([key, value]) => key + ": " + JSON.stringify(value))
      .join(", ") +
    ")",
  text: node => node.content,
  superscript: (node, formatInner, options, env) =>
    "^" + node.content.map(childNode => formatInner(childNode, options, env)).join("") + "^",
  footnoteRef: node =>
    "[^" + (typeof node.label === "number" ? node.label.toFixed() : node.label) + "]",
}

/**
 * Format inline markdown syntax from a string, returning only the text content.
 */
export const formatInline = (markdown: string): string =>
  renderInlineFromString<string, [options: FormatterOptions, env: BlockEnv]>(
    markdown.trim(),
    inlineBuilderMap,
    {
      preserveEscapes: true,
      builderArgs: [defaultOptions, defaultBlockEnv],
    },
  ).join("")

/**
 * Prints inline markdown nodes as a string.
 */
export const printInline = (markdown: InlineMarkdownNode[]): string =>
  markdown
    .map(node => renderInline(node, inlineBuilderMap, defaultOptions, defaultBlockEnv))
    .join("")

/**
 * Indents all lines exept for the first line by two spaces.
 */
const indentTail = (text: string): string => text.replace(/\n(?!\s*\n)/g, "\n  ")

type RenderedContentRow = {
  cells: {
    colSpan: number | undefined
    text: string
  }[]
}

type RenderedDividerRow = {
  type: "divider"
  cells: {
    left?: string | undefined
    middle: string
    right?: string | undefined
  }[]
}

const calculateColumnWidths = (
  node: Table,
  renderedCaption: string[] | undefined,
  renderedRows: (RenderedContentRow | RenderedDividerRow)[],
) => {
  const columnWidths = node.columns.map((_, index) =>
    Math.max(
      ...renderedRows.map((row): number => {
        if ("type" in row) {
          return 3 // minimum width for header dividers (:--, ---, --:. :-:) and section header dividers (===)
        }
        return row.cells[index]?.text.length ?? 0
      }),
    ),
  )

  const getCombinedColumnWidthsFromRow = (
    baseAcc: number[],
    row: { colSpan?: number; text: string }[],
  ) =>
    row.reduce<number[]>((acc, cell, index) => {
      const colSpan = cell.colSpan ?? 1
      const currentWidth = sum(acc.slice(index, index + colSpan)) + (colSpan - 1) * 3 // account for the " | " separators
      if (cell.text.length > currentWidth) {
        const extraWidth = cell.text.length - currentWidth
        const extraWidthPerColumn = Math.ceil(extraWidth / colSpan)
        for (let i = 0; i < colSpan; i++) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          acc[index + i]! += extraWidthPerColumn
        }
      }
      return acc
    }, baseAcc)

  const combinedColumnWidthsForRows = renderedRows.reduce(
    (acc, row) => ("type" in row ? acc : getCombinedColumnWidthsFromRow(acc, row.cells)),
    columnWidths,
  )

  const combinedColumnWidthsForRowsAndCaption =
    renderedCaption?.reduce(
      (acc, captionRow) =>
        getCombinedColumnWidthsFromRow(acc, [
          { text: "#" + captionRow + "#", colSpan: node.columns.length },
        ]),
      combinedColumnWidthsForRows,
    ) ?? combinedColumnWidthsForRows

  return combinedColumnWidthsForRowsAndCaption
}

const blockBuilderMap: BlockBuilderMap<string, string, [options: FormatterOptions, env: BlockEnv]> =
  {
    paragraph: (node, _formatInner, formatInnerInline, options, env) =>
      node.content
        .map(content =>
          content.type === "break" ? "\n" : formatInnerInline(content, options, env),
        )
        .join(""),
    heading: (node, _formatInner, formatInnerInline, options, env) =>
      "#".repeat(node.level) +
      " " +
      node.content.map(content => formatInnerInline(content, options, env)).join(""),
    list: (node, formatInner, formatInnerInline, options, env) => {
      const innerEnv = { ...env, nesting: env.nesting + 1 }
      return node.content
        .map(item =>
          [
            ...(item.inlineLabel === undefined
              ? []
              : [item.inlineLabel.map(content => formatInnerInline(content, options, innerEnv))]),
            ...item.content.map(content => formatInner(content, options, innerEnv)),
          ].join("\n\n"),
        )
        .join("\n")
    },
    table: (node, _formatInner, formatInnerInline, options, env) => {
      const formatCell = (cell: TableCell) => ({
        colSpan: cell.colSpan,
        text: cell.content.map(content => formatInnerInline(content, options, env)).join(""),
      })

      const caption = node.caption?.map(captionRow =>
        captionRow.map(content => formatInnerInline(content, options, env)).join(""),
      )

      const bodyRows: (RenderedContentRow | RenderedDividerRow)[] = [
        { cells: node.header.map(formatCell) },
        {
          type: "divider",
          cells: node.columns.map(columnStyle => ({
            left:
              columnStyle.alignment === "left" || columnStyle.alignment === "center"
                ? ":"
                : undefined,
            middle: "-",
            right:
              columnStyle.alignment === "right" || columnStyle.alignment === "center"
                ? ":"
                : undefined,
          })),
        },
        ...(checkTableRowsAreSections(node.rows)
          ? node.rows.flatMap((section, sectionIndex) => [
              ...(section.header === undefined
                ? sectionIndex === 0
                  ? []
                  : [{ type: "divider" as const, cells: node.columns.map(() => ({ middle: "-" })) }]
                : [
                    {
                      type: "divider" as const,
                      cells: node.columns.map(() => ({ middle: "=" })),
                    },
                    { cells: section.header.map(formatCell) },
                  ]),
              ...section.rows.map(row => ({
                cells: row.cells.map(formatCell),
              })),
            ])
          : node.rows.map(row => ({
              cells: row.cells.map(formatCell),
            }))),
      ]

      const columnWidths = options.alignTableDividers
        ? calculateColumnWidths(node, caption, bodyRows)
        : undefined

      const formatCaptionRow = columnWidths
        ? (row: string) =>
            "|# " + row.padStart(sum(columnWidths) + (columnWidths.length - 1) * 3, " ") + " #|\n"
        : (row: string) => "|# " + row + " #|\n"

      const formatDividerRow = columnWidths
        ? (row: RenderedDividerRow) =>
            "| " +
            row.cells
              .map((cell, index) => {
                const left = cell.left ?? ""
                const middle = cell.middle
                const right = cell.right ?? ""
                const middleWidth = (columnWidths[index] ?? 0) - left.length - right.length
                return left + middle.repeat(middleWidth) + right
              })
              .join(" | ") +
            " |"
        : (row: RenderedDividerRow) =>
            "| " +
            row.cells
              .map(cell => {
                const left = cell.left ?? ""
                const middle = cell.middle
                const right = cell.right ?? ""
                const middleWidth = 3 - left.length - right.length
                return left + middle.repeat(middleWidth) + right
              })
              .join(" | ") +
            " |"

      const formatContentRow = columnWidths
        ? (row: RenderedContentRow) =>
            "| " +
            row.cells
              .map((cell, index) => {
                const colSpan = cell.colSpan ?? 1
                const totalWidth =
                  sum(columnWidths.slice(index, index + colSpan)) + (colSpan - 1) * 3 // account for the " | " separators
                return cell.text.padEnd(totalWidth, " ")
              })
              .join(" | ") +
            " |"
        : (row: RenderedContentRow) => "| " + row.cells.map(cell => cell.text).join(" | ") + " |"

      return (
        (caption?.map(formatCaptionRow).join("") ?? "") +
        bodyRows
          .map(row => ("type" in row ? formatDividerRow(row) : formatContentRow(row)))
          .join("\n")
      )
    },
    container: (node, formatInner, _formatInnerInline, options, env) =>
      `:::${node.name === undefined ? "" : " " + node.name}

${node.content.map(content => formatInner(content, options, env)).join("\n\n")}

:::`,
    footnote: (node, formatInner, _formatInnerInline, options, env) =>
      indentTail(
        `[^${typeof node.label === "number" ? node.label.toFixed() : node.label}]: ${node.content.map(content => formatInner(content, options, env)).join("\n\n")}`,
      ),
    definitionList: (node, formatInner, formatInnerInline, options, env) =>
      node.content
        .map(
          item =>
            item.terms
              .map(term => term.map(content => formatInnerInline(content, options, env)).join(""))
              .join("\n") +
            item.descriptions
              .map(description =>
                indentTail(
                  "\n: " +
                    description.map(content => formatInner(content, options, env)).join("\n\n"),
                ),
              )
              .join(""),
        )
        .join("\n\n"),
  }

const builderMap = { ...blockBuilderMap, ...inlineBuilderMap }

export const format = (markdown: string, options?: Partial<FormatterOptions>): string =>
  renderFromString(markdown, builderMap, {
    preserveEscapes: true,
    builderArgs: [{ ...defaultOptions, ...options }, defaultBlockEnv],
  }).join("\n\n")

/**
 * Prints block markdown nodes, effectively a complete Markdown document, as a string.
 */
export const print = (markdown: BlockMarkdownNode[], options?: Partial<FormatterOptions>): string =>
  markdown
    .map(node => render(node, builderMap, { ...defaultOptions, ...options }, defaultBlockEnv))
    .join("\n\n")
