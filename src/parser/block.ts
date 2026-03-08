import { isNotEmpty } from "@elyukai/utils/array/nonEmpty"
import { isNotNullish } from "@elyukai/utils/nullable"
import { omitUndefinedKeys } from "@elyukai/utils/object"
import { StateTParser as SParser } from "@elyukai/utils/stateParser"
import { reduceSyntaxNodes, removeEmptySyntaxNodes } from "../reduce.ts"
import {
  footnoteRef,
  inlineNode,
  inlineMarkdown as inlineNodes,
  trimLastNodeEnd,
  type InlineMarkdownNode,
  type Text,
} from "./inline.ts"
import { getSyntaxSetting, type S, type StatefulParser } from "./state.ts"

const asText = (content: string): Text => ({ type: "text", content })
const asSingleText = (content: string): [Text] => [asText(content)]
const anySpacesT = SParser.regex<S>(/^ */)
const oneOrMoreSpacesT = SParser.regex<S>(/^ +/).map(asSingleText)
const newlineT = SParser.string<S>("\n")
const anyWhitespaceT = SParser.space<S>()

const sepBy1KeepFlat = <T>(
  parser: StatefulParser<T[]>,
  separator: StatefulParser<T[]>,
): StatefulParser<T[]> =>
  parser.then(first =>
    separator
      .then(lines => parser.map(next => [...lines, ...next]))
      .many()
      .map(rest => [...first, ...rest.flat()]),
  )

export type Break = { type: "break" }

export type ParagraphContent = InlineMarkdownNode | Break
export type Paragraph = { type: "paragraph"; content: ParagraphContent[] }

export type Heading = {
  type: "heading"
  level: number
  content: InlineMarkdownNode[]
}

export type List = {
  type: "list"
  ordered: boolean
  content: ListItem[]
}

export type ListItem = {
  type: "listItem"
  inlineLabel?: InlineMarkdownNode[]
  content: BlockMarkdownNode[]
}

export type Table = {
  type: "table"
  caption?: InlineMarkdownNode[]
  columns: TableColumnStyle[]
  header: TableCell[]
  rows: TableRow[] | TableSection[]
}

export const checkTableRowsAreSections = (
  rows: TableRow[] | TableSection[],
): rows is TableSection[] => rows.every(row => row.type === "tableSection")

export type TableColumnStyle = {
  alignment?: "left" | "center" | "right"
}

export type TableSection = {
  type: "tableSection"
  header?: TableCell[]
  rows: TableRow[]
}

export type TableRow = {
  type: "tableRow"
  cells: TableCell[]
}

export type TableCell = {
  type: "tableCell"
  colSpan?: number
  content: InlineMarkdownNode[]
}

export type Container = {
  type: "container"
  name?: string
  content: BlockMarkdownNode[]
}

export type Footnote = {
  type: "footnote"
  label: string | number
  content: BlockMarkdownNode[]
}

export type DefinitionList = {
  type: "definitionList"
  content: DefinitionListItem[]
}

export type DefinitionListItem = {
  type: "definitionListItem"
  terms: InlineMarkdownNode[][]
  descriptions: BlockMarkdownNode[][]
}

export type BlockMarkdownNode =
  | DefinitionList
  | Footnote
  | Container
  | Table
  | List
  | Heading
  | Paragraph

export type Syntax = {
  type: "syntax"
  blockType:
    | "heading"
    | "footnote"
    | "container"
    | "definitionList"
    | "unorderedList"
    | "orderedList"
    | "table"
  content: string
}

export type InternalBlockMarkdownSyntaxNode = InlineMarkdownNode | Syntax | Break

export type BlockMarkdownSyntaxNode = InlineMarkdownNode | Syntax

const getIndentation = SParser.getsT((state: S) => state.indentation)

const indentation: StatefulParser<[Text]> = getIndentation.then(indentation =>
  SParser.string<S>(" ".repeat(indentation)).map(asSingleText),
)

const increaseIndentation = (state: S) => ({
  ...state,
  indentation: state.indentation + 2,
})

const withIndentation = <T>(parser: StatefulParser<T>): StatefulParser<T> =>
  getIndentation.then(indentation => {
    const resetIndentation = (state: S) => ({
      ...state,
      indentation,
    })

    return parser
      .withT(increaseIndentation)
      .then(content => SParser.of<S, T>(content).withT(resetIndentation))
  })

const lineBreak: StatefulParser<(Break | Text)[]> = SParser.regex<S>(/\n(?!\s*\n|\s*$)/).then(() =>
  indentation.then(indent =>
    getSyntaxSetting.map(keepSyntax =>
      keepSyntax
        ? [
            {
              type: "break",
            },
            ...indent,
          ]
        : [
            {
              type: "break",
            },
          ],
    ),
  ),
)

const paragraphContent: StatefulParser<ParagraphContent[][]> = lineBreak
  .orFirstW(inlineNode.map(node => [node]))
  .many1()

const paragraph: StatefulParser<Paragraph> = SParser.negativeLookahead(
  SParser.regex<S>(/^:{1,3} +\S+|^:{3}$|^:{3}\s*\n/u),
)
  .then(() => paragraphContent)
  .map(
    (content): Paragraph => ({
      type: "paragraph",
      content: content.flat(),
    }),
  )

const paragraphSyntax: StatefulParser<InternalBlockMarkdownSyntaxNode[]> =
  SParser.negativeLookahead(SParser.regex<S>(/^:{1,3} +\S+|^:{3}$|^:{3}\s*\n/u))
    .then(() => paragraphContent)
    .map(content => content.flat())

const headingDelimiter = SParser.regex<S>(/^#{1,6}/)
const heading: StatefulParser<Heading> = headingDelimiter.then(result =>
  oneOrMoreSpacesT.then(() =>
    inlineNodes.map(content => ({
      type: "heading",
      level: result.length,
      content,
    })),
  ),
)
const headingSyntax: StatefulParser<InternalBlockMarkdownSyntaxNode[]> = headingDelimiter.then(
  result =>
    oneOrMoreSpacesT.then(space =>
      inlineNodes.map(content => [
        { type: "syntax", blockType: "heading", content: result },
        ...space,
        ...content,
      ]),
    ),
)

const singleLineBreakAndIndentation = newlineT.then(newline =>
  indentation.map(indent => asSingleText(newline + indent[0].content)),
)
const strictBlankLines = anySpacesT
  .then(spaces => newlineT.map(newline => spaces + newline))
  .many1()
  .map(lines => asSingleText(lines.join("")))
const anyBlankLines = anySpacesT
  .then(spaces => newlineT.map(newline => spaces + newline))
  .many()
  .map((lines): [Text] | [] => {
    const str = lines.join("")
    return str.length === 0 ? [] : asSingleText(str)
  })
const blankLines = newlineT.then(newline =>
  strictBlankLines.then(lines =>
    indentation.map(indent => asSingleText(newline + lines[0].content + indent[0].content)),
  ),
)

const unorderedListItemStartDelimiter = SParser.string<S>("-")
const orderedListItemStartDelimiter = SParser.regex<S>(/^\d+\./)
const listItemContent = oneOrMoreSpacesT
  .then(() => inlineNodes)
  .then(inlineLabel =>
    withIndentation(anyBlankLines.then(() => indentation.then(() => blockMarkdown)))
      .optional()
      .map((content = []): ListItem => ({ type: "listItem", inlineLabel, content })),
  )
const listItemContentSyntax: StatefulParser<InternalBlockMarkdownSyntaxNode[]> =
  oneOrMoreSpacesT.then(space =>
    inlineNodes.then(inlineLabel =>
      withIndentation(
        anyBlankLines
          .then((lines: Text[]) => indentation.map(indent => lines.concat(indent)))
          .then(nextLineSpacing =>
            blockMarkdownSyntax.map(content => [...nextLineSpacing, ...content]),
          ),
      )
        .optional()
        .map((content = []): InternalBlockMarkdownSyntaxNode[] => [
          ...space,
          ...inlineLabel,
          ...content,
        ]),
    ),
  )

const list = (start: StatefulParser<string>, ordered: boolean): StatefulParser<List> =>
  start
    .then(() => listItemContent)
    .separatedBy1(singleLineBreakAndIndentation)
    .map((content): List => ({ type: "list", ordered, content }))

const listItemSyntax = (start: StatefulParser<string>, ordered: boolean) =>
  start.then(startDelim =>
    listItemContentSyntax.map((content): InternalBlockMarkdownSyntaxNode[] => [
      { type: "syntax", blockType: ordered ? "orderedList" : "unorderedList", content: startDelim },
      ...content,
    ]),
  )

const listSyntax = (
  start: StatefulParser<string>,
  ordered: boolean,
): StatefulParser<InternalBlockMarkdownSyntaxNode[]> =>
  listItemSyntax(start, ordered).then(first =>
    singleLineBreakAndIndentation
      .then(separator =>
        listItemSyntax(start, ordered).map((next): InternalBlockMarkdownSyntaxNode[] => [
          ...separator,
          ...next,
        ]),
      )
      .many()
      .map((content): InternalBlockMarkdownSyntaxNode[] => [...first, ...content.flat()]),
  )

const orderedList = list(orderedListItemStartDelimiter, true)
const orderedListSyntax = listSyntax(orderedListItemStartDelimiter, true)
const unorderedList = list(unorderedListItemStartDelimiter, false)
const unorderedListSyntax = listSyntax(unorderedListItemStartDelimiter, false)

const definitionTerms = SParser.lookahead(SParser.regex<S>(/^(?!: ).+/))
  .then(() => inlineNode.many1())
  .separatedBy1(singleLineBreakAndIndentation)

const definitionTermsSyntax = sepBy1KeepFlat<InternalBlockMarkdownSyntaxNode>(
  SParser.lookahead(SParser.regex<S>(/^(?!: ).+/)).then(() => inlineNode.many1()),
  singleLineBreakAndIndentation,
)

const definitionDescriptions = singleLineBreakAndIndentation
  .then(() => SParser.string<S>(": ").then(() => withIndentation(blockMarkdown)))
  .many1()

const definitionDescriptionsSyntax = singleLineBreakAndIndentation
  .then(whitespace =>
    SParser.string<S>(": ").then(colonSpace =>
      withIndentation(blockMarkdownSyntax).map((content): InternalBlockMarkdownSyntaxNode[] => [
        ...whitespace,
        { type: "syntax", blockType: "definitionList", content: colonSpace },
        ...content,
      ]),
    ),
  )
  .many1()

const definitionList = definitionTerms
  .then(terms =>
    definitionDescriptions.map(
      (descriptions): DefinitionListItem => ({ type: "definitionListItem", terms, descriptions }),
    ),
  )
  .separatedBy1(blankLines)
  .map((content): DefinitionList => ({ type: "definitionList", content }))

const definitionListSyntax = sepBy1KeepFlat<InternalBlockMarkdownSyntaxNode>(
  definitionTermsSyntax.then(terms =>
    definitionDescriptionsSyntax.map(descriptions => [...terms, ...descriptions.flat()]),
  ),
  blankLines,
)

const containerDelimiter = SParser.string<S>(":::")
const containerName = SParser.regex<S>(/^\w+/)

const container: StatefulParser<Container> = containerDelimiter
  .then(() => oneOrMoreSpacesT)
  .then(() => containerName)
  .then(name =>
    blankLines
      .then(() => blockMarkdown)
      .then(content =>
        blankLines.then(() => containerDelimiter).map(() => ({ type: "container", name, content })),
      ),
  )

const containerSyntax: StatefulParser<InternalBlockMarkdownSyntaxNode[]> = containerDelimiter.then(
  delim =>
    oneOrMoreSpacesT.then(delimSpace =>
      containerName.then(name =>
        blankLines.then(startSpace =>
          indentation.then(startIndent =>
            blockMarkdownSyntax.then(content =>
              blankLines.then(endSpace =>
                indentation.then(endIndent =>
                  containerDelimiter.map((endDelim): InternalBlockMarkdownSyntaxNode[] => [
                    {
                      type: "syntax",
                      blockType: "container",
                      content: delim + delimSpace[0].content + name,
                    },
                    asText(startSpace[0].content + startIndent[0].content),
                    ...content,
                    asText(endSpace[0].content + endIndent[0].content),
                    { type: "syntax", blockType: "container", content: endDelim },
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
)

const footnote: StatefulParser<Footnote> = footnoteRef.then(ref =>
  SParser.string<S>(":")
    .then(() => oneOrMoreSpacesT)
    .then(() => withIndentation(blockMarkdown))
    .map(content => ({
      type: "footnote",
      label: ref.label,
      content,
    })),
)

const footnoteSyntax: StatefulParser<InternalBlockMarkdownSyntaxNode[]> = footnoteRef.then(ref =>
  SParser.string<S>(":").then(colon =>
    oneOrMoreSpacesT.then(space =>
      withIndentation(blockMarkdownSyntax).map(content => [
        { type: "syntax", blockType: "footnote", content: ref.content + colon },
        ...space,
        ...content,
      ]),
    ),
  ),
)

const tableHeaderSeparatorCell = SParser.regex<S>(/^:?-+:?/)
const tableSectionWithSubheaderSeparatorCell = SParser.regex<S>(/^={3,}/)
const tableSectionSeparatorCell = SParser.regex<S>(/^-{3,}/)
const getAlignmentFromSeparator = (separator: string): TableColumnStyle["alignment"] => {
  const left = separator.startsWith(":")
  const right = separator.endsWith(":")
  return left ? (right ? "center" : "left") : right ? "right" : undefined
}
const tableSeparator = SParser.string<S>("|")
const tableContentCellGuard = SParser.lookahead(SParser.regex<S>(/^ *\S+/u))
const tableRow = <T>(parser: StatefulParser<T>, withIndentation = true): StatefulParser<T[]> =>
  (withIndentation ? indentation.then(() => tableSeparator.htoken()) : tableSeparator.htoken())
    .then(() => parser.separatedBy1(tableSeparator.htoken()))
    .then(header => tableSeparator.map(() => header))
const tableRowSyntax = (
  parser: StatefulParser<InternalBlockMarkdownSyntaxNode[]>,
  withIndentation = true,
): StatefulParser<InternalBlockMarkdownSyntaxNode[]> =>
  (withIndentation
    ? indentation.then(indent => tableSeparator.map(startDelim => ({ indent, startDelim })))
    : tableSeparator.map((startDelim): { startDelim: string; indent?: undefined } => ({
        startDelim,
      }))
  ).then(startDelim =>
    anySpacesT.then(startSpace =>
      sepBy1KeepFlat(
        parser,
        tableSeparator.then(delim =>
          anySpacesT.map(space => {
            const base: (InternalBlockMarkdownSyntaxNode | undefined)[] = [
              { type: "syntax", blockType: "table", content: delim },
              space.length === 0 ? undefined : asText(space),
            ]
            return base.filter(isNotNullish)
          }),
        ),
      ).then(content =>
        tableSeparator.map((endDelim): InternalBlockMarkdownSyntaxNode[] => [
          ...(startDelim.indent ?? []),
          { type: "syntax", blockType: "table", content: startDelim.startDelim },
          asText(startSpace),
          ...content,
          { type: "syntax", blockType: "table", content: endDelim },
        ]),
      ),
    ),
  )

const tableCaptionRow = SParser.string<S>("|#")
  .htoken()
  .then(() => inlineNodes.htoken())
  .then(caption =>
    SParser.string<S>("#|")
      .htoken()
      .then(() => newlineT)
      .map(() => caption),
  )
  .optional()

const tableCaptionRowSyntax = SParser.string<S>("|#")
  .then(startDelim =>
    anySpacesT.then(leadingSpace =>
      inlineNodes.then(caption =>
        anySpacesT.then(trailingSpace =>
          SParser.string<S>("#|").then(endDelim =>
            anySpacesT.then(endSpace =>
              newlineT.map((newline): InternalBlockMarkdownSyntaxNode[] => [
                { type: "syntax", blockType: "table", content: startDelim },
                asText(leadingSpace),
                ...caption,
                asText(trailingSpace),
                { type: "syntax", blockType: "table", content: endDelim },
                asText(endSpace + newline),
              ]),
            ),
          ),
        ),
      ),
    ),
  )
  .optional()

const tableHeaderRow = tableRow(
  tableContentCellGuard.then(() => inlineNodes),
  false,
)
const tableHeaderRowSyntax = tableRowSyntax(
  tableContentCellGuard.then(() => inlineNodes),
  false,
)
const tableSeparatorRow = tableRow(tableHeaderSeparatorCell.htoken())
const tableSeparatorRowSyntax = tableRowSyntax(
  tableHeaderSeparatorCell.then(separator =>
    anySpacesT.map(trailingSpaces => [
      { type: "syntax", blockType: "table", content: separator },
      ...(trailingSpaces.length > 0 ? [asText(trailingSpaces)] : []),
    ]),
  ),
)
const tableNormalRow = tableRow(
  tableContentCellGuard
    .then(() => inlineNodes)
    .htoken()
    .then(content =>
      SParser.lookahead(SParser.string<S>("||"))
        .then(() => SParser.string("|"))
        .many()
        .map(span => ({ content, span: span.length > 0 ? span.length + 1 : undefined })),
    ),
)
const tableNormalRowSyntax = tableRowSyntax(
  tableContentCellGuard.then(() =>
    inlineNodes.then(content =>
      anySpacesT.then(trailingSpace =>
        SParser.lookahead(SParser.string<S>("||"))
          .then(() => SParser.string("|"))
          .many()
          .map(span => [
            ...content,
            asText(trailingSpace),
            ...(span.length > 0
              ? [
                  {
                    type: "syntax" as const,
                    blockType: "table" as const,
                    content: "|".repeat(span.length),
                  },
                ]
              : []),
          ]),
      ),
    ),
  ),
)
const tableSectionWithSubheaderSeparatorRow = tableRow(tableSectionWithSubheaderSeparatorCell)
const tableSectionWithSubheaderSeparatorRowSyntax = tableRowSyntax(
  tableSectionWithSubheaderSeparatorCell.map(separator => [
    { type: "syntax", blockType: "table", content: separator },
  ]),
)
const tableSectionSubheaderWithSeparatorRow = tableSectionWithSubheaderSeparatorRow
  .then(() => newlineT)
  .then(() => tableNormalRow)
  .map(header => ({
    type: "newSection" as const,
    header,
  }))
const tableSectionSubheaderWithSeparatorRowSyntax =
  tableSectionWithSubheaderSeparatorRowSyntax.then(separatorRow =>
    newlineT.then(newline =>
      tableNormalRowSyntax.map(sectionHeader => [
        ...separatorRow,
        asText(newline),
        ...sectionHeader,
      ]),
    ),
  )
const tableSectionPlainSeparatorRow = tableRow(tableSectionSeparatorCell).map(() => ({
  type: "newSection" as const,
}))
const tableSectionPlainSeparatorRowSyntax = tableRowSyntax(
  tableSectionSeparatorCell.map(separator => [
    { type: "syntax", blockType: "table", content: separator },
  ]),
)
const tableBodyRow = tableSectionSubheaderWithSeparatorRow
  .orFirstW(tableSectionPlainSeparatorRow)
  .orFirstW(tableNormalRow)
const tableBodyRowSyntax = tableSectionSubheaderWithSeparatorRowSyntax
  .orFirstW(tableSectionPlainSeparatorRowSyntax)
  .orFirstW(tableNormalRowSyntax)

const mapCell = (cell: InlineMarkdownNode[]): TableCell => ({
  type: "tableCell",
  content: trimLastNodeEnd(cell),
})

const mapCellObj = (cell: { content: InlineMarkdownNode[]; span?: number }): TableCell =>
  omitUndefinedKeys({
    type: "tableCell",
    content: trimLastNodeEnd(cell.content),
    colSpan: cell.span,
  })

const sectionRows = (
  rows: (
    | { content: InlineMarkdownNode[]; span?: number }[]
    | { type: "newSection"; header?: { content: InlineMarkdownNode[]; span?: number }[] }
  )[],
): TableRow[] | TableSection[] => {
  if (rows.some(row => "type" in row)) {
    return rows.reduce<TableSection[]>((acc, row) => {
      if ("type" in row) {
        acc.push(
          omitUndefinedKeys({
            type: "tableSection",
            header: row.header?.map(mapCellObj),
            rows: [],
          }),
        )
      } else {
        const lastSection = acc[acc.length - 1] ?? (acc[0] = { type: "tableSection", rows: [] })
        lastSection.rows.push({
          type: "tableRow",
          cells: row.map(mapCellObj),
        })
      }
      return acc
    }, [])
  } else {
    return (rows as { content: InlineMarkdownNode[]; span: number }[][]).map(
      (row): TableRow => ({
        type: "tableRow",
        cells: row.map(mapCellObj),
      }),
    )
  }
}

const table: StatefulParser<Table> = tableCaptionRow.then(caption =>
  (caption.length === 0 ? SParser.of<S, []>([]) : indentation).then(() =>
    tableHeaderRow.then(header =>
      newlineT
        .then(() => tableSeparatorRow)
        .then(separators =>
          newlineT
            .then(() => tableBodyRow.separatedBy1(newlineT))
            .map(
              (rows): Table =>
                omitUndefinedKeys({
                  type: "table",
                  caption: caption === undefined ? undefined : trimLastNodeEnd(caption),
                  columns: separators.map(
                    (cell): TableColumnStyle =>
                      omitUndefinedKeys({ alignment: getAlignmentFromSeparator(cell) }),
                  ),
                  header: header.map(mapCell),
                  rows: sectionRows(rows),
                }),
            ),
        ),
    ),
  ),
)

const tableSyntax: StatefulParser<InternalBlockMarkdownSyntaxNode[]> = tableCaptionRowSyntax.then(
  caption =>
    (caption.length === 0 ? SParser.of<S, []>([]) : indentation).then(
      indentBetweenCaptionAndHeader =>
        tableHeaderRowSyntax.then(header =>
          newlineT.then(headerNewline =>
            tableSeparatorRowSyntax.then(separators =>
              newlineT.then(separatorsNewline =>
                sepBy1KeepFlat(tableBodyRowSyntax, newlineT.map(asSingleText)).map(rows => [
                  ...(caption === undefined ? [] : caption),
                  ...indentBetweenCaptionAndHeader,
                  ...header,
                  asText(headerNewline),
                  ...separators,
                  asText(separatorsNewline),
                  ...rows,
                ]),
              ),
            ),
          ),
        ),
    ),
)

const blockMarkdown: StatefulParser<BlockMarkdownNode[]> = heading
  .orFirstW(footnote)
  .orFirstW(container)
  .orFirstW(definitionList)
  .orFirstW(unorderedList)
  .orFirstW(orderedList)
  .orFirstW(table)
  .orFirstW(paragraph)
  .separatedBy1(blankLines)

const blockMarkdownSyntax: StatefulParser<InternalBlockMarkdownSyntaxNode[]> =
  sepBy1KeepFlat<InternalBlockMarkdownSyntaxNode>(
    headingSyntax
      .orFirstW(footnoteSyntax)
      .orFirstW(containerSyntax)
      .orFirstW(definitionListSyntax)
      .orFirstW(unorderedListSyntax)
      .orFirstW(orderedListSyntax)
      .orFirstW(tableSyntax)
      .orFirstW(paragraphSyntax),
    blankLines,
  )

export const finalBlockMarkdown: StatefulParser<BlockMarkdownNode[] | undefined> = anyBlankLines
  .then(() => blockMarkdown)
  .then(result => anyWhitespaceT.map(() => result))
  .optional()

export const finalBlockMarkdownSyntax: StatefulParser<BlockMarkdownSyntaxNode[]> =
  anyBlankLines.then(leadingsNewlines =>
    blockMarkdownSyntax
      .then(result =>
        anyWhitespaceT.map((trailingSpace): InternalBlockMarkdownSyntaxNode[] => [
          ...result,
          { type: "text", content: trailingSpace },
        ]),
      )
      .optional()
      .map((result = []) =>
        reduceSyntaxNodes([
          ...leadingsNewlines,
          ...removeEmptySyntaxNodes(result).map(node =>
            node.type === "break" ? { type: "text" as const, content: "\n" } : node,
          ),
        ]),
      ),
  )

export const parseBlockMarkdown = (syntax: string): BlockMarkdownNode[] => {
  const results = finalBlockMarkdown.evalT({ indentation: 0, keepSyntax: false }).parse(syntax)

  if (!isNotEmpty(results)) {
    throw new Error(`Failed to parse`)
  }

  const [result = [], remaining] = results[0]

  if (remaining.length > 0) {
    return [...result, { type: "paragraph", content: [{ type: "text", content: remaining }] }]
    // throw new Error(`Failed to parse the entire string. Remaining: "${remaining}"`)
  }

  return result
}

export const parseBlockMarkdownForSyntaxHighlighting = (
  syntax: string,
): BlockMarkdownSyntaxNode[] => {
  const results = finalBlockMarkdownSyntax.evalT({ indentation: 0, keepSyntax: true }).parse(syntax)

  if (!isNotEmpty(results)) {
    throw new Error(`Failed to parse`)
  }

  const [result, remaining] = results[0]

  if (remaining.length > 0) {
    return [...result, { type: "text", content: remaining }]
    // throw new Error(`Failed to parse the entire string. Remaining: "${remaining}"`)
  }

  return result
}
