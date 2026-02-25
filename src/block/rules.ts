import { chunk } from "@elyukai/utils/array/groups"
import { omitUndefinedKeys } from "@elyukai/utils/object"
import { assertExhaustive } from "@elyukai/utils/typeSafety"
import { detectIndentation, removeIndentation } from "../indentation.ts"
import {
  parseBlockMarkdown,
  parseBlockMarkdownForSyntaxHighlighting,
  parseInlineMarkdown,
  parseInlineMarkdownForSyntaxHighlighting,
} from "../index.ts"
import { textNode, type InlineMarkdownNode, type TextNode } from "../inline/node.ts"
import type {
  BlockMarkdownNode,
  BlockSyntaxMarkdownNode,
  DefinitionListBlockNode,
  ListBlockNode,
  ListItemNode,
  TableBlockNode,
  TableCellBlockNode,
  TableRowBlockNode,
  TableSectionBlockNode,
} from "./node.ts"

export type BlockRule = {
  pattern: RegExp
  predicate?: (result: RegExpExecArray) => boolean
  map: (result: RegExpExecArray) => BlockMarkdownNode
  mapHighlighting: (result: RegExpExecArray) => BlockSyntaxMarkdownNode[]
}

const nodesForTrailingWhitespace = (text: string | undefined): InlineMarkdownNode[] => {
  const trailingWhitespace = text ?? ""
  return trailingWhitespace.length === 0 ? [] : [textNode(trailingWhitespace)]
}

const listRule: BlockRule = {
  // pattern: /^((?:(?:\d+\.|[-*]) [^\n]+?)(?:\n(?:\d+\.|[-*]) [^\n]+?)*)(\n{2,}|\s*$)/,
  pattern:
    /^((?:(?:\d+\. +[^\n]+(?:\n\d+\. +[^\n]+|\n {2,}[^\n]+|\n)*)|(?:- +[^\n]+(?:\n- +[^\n]+|\n {2,}[^\n]+|\n)*)))(\n{2,}|\s*$)/,
  map: result => {
    const listItemPairs = (result[1] ?? "").split(/(?:^|\n)(?:\d+\.|-)/).slice(1)
    const listItems = listItemPairs.map((itemText): ListItemNode => {
      const [primaryContent = "", _separator, ...additionalContents] = itemText.split(
        /(\n *\n|\n(?= +(?:\d+\.|-) ))/,
      )
      const additionalContent = additionalContents.join("")
      const primaryContentNodes = parseInlineMarkdown(primaryContent.trim())
      const additionalContentNodes = additionalContent
        ? parseBlockMarkdown(removeIndentation(additionalContent))
        : []
      if (
        additionalContentNodes.length < 2 &&
        (additionalContentNodes[0] === undefined || additionalContentNodes[0].kind === "list")
      ) {
        return omitUndefinedKeys({
          kind: "listItem",
          inlineLabel: primaryContentNodes,
          content: [additionalContentNodes[0] as ListBlockNode | undefined].filter(
            element => element !== undefined,
          ),
        })
      } else {
        return omitUndefinedKeys({
          kind: "listItem",
          content: additionalContentNodes,
        })
      }
    })
    return {
      kind: "list",
      ordered: /^\d+\. /.test(result[0]),
      content: listItems,
    }
  },
  mapHighlighting: result => {
    const listItemPairs = chunk((result[1] ?? "").split(/(?:^|\n)(\d+\.|-)/).slice(1), 2)
    const listItems = listItemPairs.flatMap(
      (item, itemIndex, itemArray): BlockSyntaxMarkdownNode[] => {
        const [marker = "", itemText = ""] = item
        const [primaryContent = "", separator, ...additionalContents] = itemText.split(
          /(\n *\n|\n(?= +(?:\d+\.|-) ))/,
        )
        const additionalContent = additionalContents.join("")
        return [
          {
            kind: "listItemMarker",
            content: marker,
          },
          ...parseInlineMarkdownForSyntaxHighlighting(primaryContent),
          ...(separator ? [textNode(separator)] : []),
          ...addIndentationToSyntax(
            parseBlockMarkdownForSyntaxHighlighting(removeIndentation(additionalContent)),
            detectIndentation(additionalContent),
          ),
          ...(itemIndex < itemArray.length - 1 ? [textNode("\n")] : []),
        ]
      },
    )

    return [...listItems, ...nodesForTrailingWhitespace(result[2])]
  },
}

const paragraphRule: BlockRule = {
  pattern: /^((?:[^\n]+?)(?:\n[^\n]+?)*)(\n{2,}|\s*$)/,
  map: ([_res, content = "", _trailingWhitespace]) => ({
    kind: "paragraph",
    content: parseInlineMarkdown(content),
  }),
  mapHighlighting: ([_res, content = "", trailingWhitespace]) => [
    ...parseInlineMarkdownForSyntaxHighlighting(content),
    ...nodesForTrailingWhitespace(trailingWhitespace),
  ],
}

const headingRule: BlockRule = {
  pattern: /^(#+)( +)([^\s\n][^\n]*?)(\n{2,}|\s*$)/,
  map: result => ({
    kind: "heading",
    level: result[1]?.length ?? 1,
    content: parseInlineMarkdown(result[3] ?? ""),
  }),
  mapHighlighting: result => [
    { kind: "headingMarker", content: (result[1] ?? "") + (result[2] ?? "") },
    ...parseInlineMarkdownForSyntaxHighlighting(result[3] ?? ""),
    ...nodesForTrailingWhitespace(result[4]),
  ],
}

const tableMarker = (text: string): BlockSyntaxMarkdownNode => ({
  kind: "tableMarker",
  content: text,
})

const sectionSeparatorPattern =
  /^\|? *-{3,} *(?:\| *-{3,} *)+\|?$|^\|? *={3,} *(?:\| *={3,} *)+\|?$/
const sectionWithHeaderSeparatorPattern = /^\|? *={3,} *(?:\| *={3,} *)+\|?$/

export const checkTableRowsAreSections = (
  rows: TableRowBlockNode[] | TableSectionBlockNode[],
): rows is TableSectionBlockNode[] => rows.every(row => row.kind === "tableSection")

const parseContentRow = (row: string): TableCellBlockNode[] =>
  row
    .replace(/^\|/, "")
    .split(/(\|+)/)
    .reduce<TableCellBlockNode[]>((acc, segment, index, arr) => {
      if (index % 2 === 0 && segment.trim() !== "") {
        const colSpan = arr[index + 1]?.length
        return [
          ...acc,
          omitUndefinedKeys({
            kind: "tableCell",
            colSpan: colSpan !== undefined && colSpan > 1 ? colSpan : undefined,
            content: parseInlineMarkdown(segment.trim()),
          }),
        ]
      }

      return acc
    }, [])

const parseContentRowForSyntaxHighlighting = (row: string): BlockSyntaxMarkdownNode[] =>
  row.split(/(\|+)/).reduce<BlockSyntaxMarkdownNode[]>((acc, segment, index) => {
    if (index % 2 === 0) {
      return [...acc, ...parseInlineMarkdownForSyntaxHighlighting(segment)]
    } else {
      return [...acc, tableMarker(segment)]
    }
  }, [])

const trimPipes = (text: string) => text.replace(/^\|/, "").replace(/\|$/, "")

const parseTableAlignment = (text: string): "left" | "center" | "right" | undefined => {
  const trimmed = text.trim()
  if (/^:-+:$/.test(trimmed)) {
    return "center"
  } else if (/^:-+$/.test(trimmed)) {
    return "left"
  } else if (/^-+:$/.test(trimmed)) {
    return "right"
  } else {
    return undefined
  }
}

const tableRule: BlockRule = {
  pattern:
    /^(?:(\|#)(.+?)(#\|)\n)?(\|)?(.+?(?:(?<!\\)\|.+?)+)((?<!\\)\|)?\n((?:\| *)?(?:-{3,}|:-{2,}|-{2,}:|:-+:)(?: *\| *(?:-{3,}|:-{2,}|-{2,}:|:-+:))*(?: *\|)?)((?:\n\|?.+?(?:(?<!\\)\|+.+?)*(?:(?<!\\)\|+)?)+)(\n{2,}|$)/,
  map: ([
    _res,
    _captionMarkerStart,
    caption,
    _captionMarkerEnd,
    _headerMarkerStart,
    headers,
    _headerMarkerEnd,
    bodySeparators = "",
    body,
    _trailingWhitespace,
  ]): TableBlockNode =>
    omitUndefinedKeys({
      kind: "table",
      caption:
        caption !== undefined
          ? parseInlineMarkdownForSyntaxHighlighting(caption.trim())
          : undefined,
      columns: trimPipes(bodySeparators)
        .split("|")
        .map(col =>
          omitUndefinedKeys({
            alignment: parseTableAlignment(col),
          }),
        ),
      header: headers ? parseContentRow(headers) : [],
      rows:
        body
          ?.split("\n")
          .slice(1) // leading newline due to regex
          .reduce<TableRowBlockNode[] | TableSectionBlockNode[]>((accRows, row) => {
            if (sectionSeparatorPattern.test(row)) {
              const hasHeader = sectionWithHeaderSeparatorPattern.test(row)
              const newSection: TableSectionBlockNode = omitUndefinedKeys({
                kind: "tableSection",
                header: hasHeader ? [] : undefined,
                rows: [],
              })

              if (accRows[0] === undefined) {
                return [newSection]
              }

              if (checkTableRowsAreSections(accRows)) {
                return [...accRows, newSection]
              }

              return [{ kind: "tableSection", rows: accRows }, newSection]
            }

            const lastRow = accRows[accRows.length - 1]
            const rowContent = parseContentRow(row)

            if (lastRow === undefined) {
              return [
                {
                  kind: "tableRow",
                  cells: rowContent,
                },
              ]
            }

            if (checkTableRowsAreSections(accRows)) {
              const lastSection = lastRow as TableSectionBlockNode
              if (lastSection.header !== undefined && lastSection.header.length === 0) {
                return [
                  ...accRows.slice(0, -1),
                  {
                    ...lastSection,
                    header: rowContent,
                  },
                ]
              }

              return [
                ...accRows.slice(0, -1),
                {
                  ...lastSection,
                  rows: [
                    ...lastSection.rows,
                    {
                      kind: "tableRow",
                      cells: rowContent,
                    },
                  ],
                },
              ]
            }

            return [
              ...accRows,
              {
                kind: "tableRow",
                cells: rowContent,
              },
            ]
          }, []) ?? [],
    }),
  mapHighlighting: ([
    _res,
    captionMarkerStart,
    caption,
    captionMarkerEnd,
    headerMarkerStart,
    headers,
    headerMarkerEnd,
    bodySeparators,
    body,
    trailingWhitespace,
  ]) => [
    ...(caption !== undefined
      ? [
          tableMarker(captionMarkerStart ?? ""),
          ...parseInlineMarkdownForSyntaxHighlighting(caption),
          tableMarker(captionMarkerEnd ?? ""),
          textNode("\n"),
        ]
      : []),
    tableMarker(headerMarkerStart ?? ""),
    ...(headers
      ?.split("|")
      .flatMap((th, i): BlockSyntaxMarkdownNode[] =>
        i === 0
          ? parseInlineMarkdownForSyntaxHighlighting(th)
          : [tableMarker("|"), ...parseInlineMarkdownForSyntaxHighlighting(th)],
      ) ?? []),
    tableMarker(headerMarkerEnd ?? ""),
    textNode("\n"),
    tableMarker(bodySeparators ?? ""),
    ...(body
      ?.split("\n")
      .slice(1)
      .flatMap((tr): BlockSyntaxMarkdownNode[] => [
        textNode("\n"),
        ...(sectionSeparatorPattern.test(tr)
          ? [tableMarker(tr)]
          : parseContentRowForSyntaxHighlighting(tr)),
      ]) ?? []),
    ...nodesForTrailingWhitespace(trailingWhitespace),
  ],
}

const containerRule: BlockRule = {
  pattern: /^::: ([\w-_]+)?(\n+)(.+?)\n:::(\n{2,}|\s*$)/s,
  map: ([
    _match,
    name,
    _leadingContentWhitespace,
    content,
    _trailingWhitespace,
  ]): BlockMarkdownNode => ({
    kind: "container",
    name: name ?? undefined,
    content: parseBlockMarkdown(content ?? ""),
  }),
  mapHighlighting: ([
    _match,
    name,
    leadingContentWhitespace = "",
    content,
    trailingWhitespace,
  ]): BlockSyntaxMarkdownNode[] => [
    { kind: "sectionMarker", content: `::: ${name ?? ""}` },
    textNode(leadingContentWhitespace),
    ...parseBlockMarkdownForSyntaxHighlighting(content ?? ""),
    textNode("\n"),
    { kind: "sectionMarker", content: ":::" },
    ...nodesForTrailingWhitespace(trailingWhitespace),
  ],
}

const addIndentationToSyntax = <T extends BlockSyntaxMarkdownNode>(
  nodes: (TextNode | T)[],
  indentation: number,
  excludeFirstLine = false,
): (TextNode | T)[] =>
  nodes.reduce<(TextNode | T)[]>(
    (accNodes, currentNode) => {
      switch (currentNode.kind) {
        case "bold":
        case "italic":
        case "link":
        case "attributed":
        case "superscript":
          return [
            ...accNodes,
            {
              ...currentNode,
              content: addIndentationToSyntax(currentNode.content, indentation, excludeFirstLine),
            },
          ]
        case "text":
        case "code":
        case "listItemMarker":
        case "tableMarker":
        case "headingMarker":
        case "sectionMarker":
        case "footnoteMarker":
        case "definitionMarker": {
          return [
            ...accNodes,
            {
              ...currentNode,
              content: currentNode.content.replace(/\n(?!\n)/g, "\n" + " ".repeat(indentation)),
            },
          ]
        }
        case "footnoteRef":
          return [...accNodes, currentNode]
        default:
          return assertExhaustive(currentNode)
      }
    },
    excludeFirstLine ? [] : [textNode(" ".repeat(indentation))],
  )

const footnoteRule: BlockRule = {
  pattern: /^\[\^([a-zA-Z0-9]+?)\]: (.+?(?:\n(?: {2}.+)?)*)(\n{2,}|\s*$)/,
  map: ([_match, label = "", content = "", _trailingWhitespace]): BlockMarkdownNode => ({
    kind: "footnote",
    label: label,
    content: parseBlockMarkdown(removeIndentation(content, true)),
  }),
  mapHighlighting: ([
    _match,
    label = "",
    content = "",
    trailingWhitespace,
  ]): BlockSyntaxMarkdownNode[] => [
    { kind: "footnoteMarker", content: `[^${label}]:` },
    textNode(" "),
    ...addIndentationToSyntax(
      parseBlockMarkdownForSyntaxHighlighting(removeIndentation(content, true)),
      detectIndentation(content, true),
      true,
    ),
    ...nodesForTrailingWhitespace(trailingWhitespace),
  ],
}

const definitionListItemSeparatorPattern = /(^.+?(?=\n:)|\n\n[^: ].*?(?=\n:))/s

const definitionListRule: BlockRule = {
  pattern:
    /^((?:[^\n]+?(?:\n[^\n]+?)*)(?:\n: .+?(?:\n {2}.+?)*)+(?:\n\n(?:[^\n]+?(?:\n[^\n]+?)*)(?:\n: .+?(?:\n(?=\n)|\n {2}.+?)*))*)(\n{2,}|\s*$)/,
  map: ([_res, content = "", _trailingWhitespace]): DefinitionListBlockNode => {
    const definitionItemPairs = chunk(content.split(definitionListItemSeparatorPattern).slice(1), 2)
    const items = definitionItemPairs.map(([termsText = "", definitionsText = ""]) => {
      const terms = termsText
        .trim()
        .split("\n")
        .map(term => parseInlineMarkdown(term.trim()))
      const definitions = definitionsText
        .split("\n:")
        .slice(1)
        .map(definition => parseBlockMarkdown(removeIndentation(definition.trim(), true)))
      return {
        kind: "definitionListItem" as const,
        terms,
        definitions,
      }
    })
    return {
      kind: "definitionList",
      content: items,
    }
  },
  mapHighlighting: ([_res, content = "", trailingWhitespace]): BlockSyntaxMarkdownNode[] => {
    const items = chunk(content.split(definitionListItemSeparatorPattern).slice(1), 2).flatMap(
      chunk => {
        const [termsText = "", definitionsText = ""] = chunk
        const terms = termsText
          .split("\n")
          .flatMap((term, index, termArray) => [
            ...parseInlineMarkdownForSyntaxHighlighting(term),
            ...(index < termArray.length - 1 ? [textNode("\n")] : []),
          ])
        const definitions = definitionsText
          .split("\n:")
          .slice(1)
          .flatMap((definition, defIndex, defArray): BlockSyntaxMarkdownNode[] => [
            { kind: "definitionMarker", content: ":" },
            ...addIndentationToSyntax(
              parseBlockMarkdownForSyntaxHighlighting(removeIndentation(definition, true)),
              detectIndentation(definition, true),
              true,
            ),
            ...(defIndex < defArray.length - 1 ? [textNode("\n")] : []),
          ])
        return [...terms, textNode("\n"), ...definitions]
      },
    )
    return [...items, ...nodesForTrailingWhitespace(trailingWhitespace)]
  },
}

export const blockRules: BlockRule[] = [
  containerRule,
  headingRule,
  footnoteRule,
  tableRule,
  listRule,
  definitionListRule,
  paragraphRule,
]
