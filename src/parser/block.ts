import { isNotEmpty } from "@elyukai/utils/array/nonEmpty"
import { omitUndefinedKeys } from "@elyukai/utils/object"
import { Parser } from "@elyukai/utils/parser"
import { StateTParser } from "@elyukai/utils/stateParser"
import {
  footnoteRef,
  inlineMarkdown,
  inlineNode,
  trimLastNodeEnd,
  type InlineMarkdownNode,
} from "./inline.ts"

type BlockState = {
  indentation: number
}

type S = BlockState

type StatefulParser<T> = StateTParser<S, T>
const lift: <T>(parser: Parser<T>) => StatefulParser<T> = parser => StateTParser.lift(parser)
const anySpacesT = StateTParser.regex<S>(/^ */)
const oneOrMoreSpacesT = StateTParser.regex<S>(/^ +/)
const newlineT = StateTParser.string<S>("\n")
const anyWhitespaceT = StateTParser.space<S>()

const inlineNodeT: StatefulParser<InlineMarkdownNode> = StateTParser.lift(inlineNode)
const inlineNodesT: StatefulParser<InlineMarkdownNode[]> = StateTParser.lift(inlineMarkdown)

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
  label: string
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

const indentation: StatefulParser<string> = StateTParser.getT<S>().then(state =>
  StateTParser.string(" ".repeat(state.indentation)),
)

const getIndentation = StateTParser.getsT((state: S) => state.indentation)
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
      .then(content => StateTParser.of<S, T>(content).withT(resetIndentation))
  })

const lineBreak: StatefulParser<Break> = StateTParser.regex<S>(/\n(?!\s*\n|\s*$)/)
  .then(() => indentation)
  .map(() => ({
    type: "break",
  }))

const paragraphContent: StatefulParser<ParagraphContent[]> = lineBreak.orFirstW(inlineNodeT).many1()

const paragraph: StatefulParser<Paragraph> = StateTParser.negativeLookahead(
  StateTParser.regex<S>(/^:{1,3} +\S+|^:{3}$|^:{3}\s*\n/u),
)
  .then(() => paragraphContent)
  .map(content => ({
    type: "paragraph",
    content,
  }))

const headingDelimiter = lift(Parser.regex(/^#{1,6}/))
const heading: StatefulParser<Heading> = headingDelimiter.then(result =>
  oneOrMoreSpacesT.then(() =>
    inlineNodesT.map(content => ({ type: "heading", level: result.length, content })),
  ),
)

const singleLineBreakAndIndentation = newlineT.then(() => indentation)
const strictBlankLines = anySpacesT.then(() => newlineT).many1()
const blankLines = newlineT.then(() => strictBlankLines).then(() => indentation)

const unorderedListItemStartDelimiter = lift(Parser.string<string>("-"))
const orderedListItemStartDelimiter = lift(Parser.regex(/^\d+\./))
const listItemContent = oneOrMoreSpacesT
  .then(() => inlineNodesT)
  .then(inlineLabel =>
    withIndentation(singleLineBreakAndIndentation.then(() => blockMarkdown))
      .orFirst(StateTParser.of([]))
      .map((content): ListItem => ({ type: "listItem", inlineLabel, content })),
  )

const list = (start: StatefulParser<string>, ordered: boolean): StatefulParser<List> =>
  start
    .then(() => listItemContent)
    .separatedBy1(singleLineBreakAndIndentation)
    .map((content): List => ({ type: "list", ordered, content }))

const orderedList = list(orderedListItemStartDelimiter, true)
const unorderedList = list(unorderedListItemStartDelimiter, false)

const definitionTerms = lift(Parser.lookahead(Parser.regex(/^(?!: ).+/)))
  .then(() => inlineNodeT.many1())
  .separatedBy1(singleLineBreakAndIndentation)

const definitionDescriptions = singleLineBreakAndIndentation
  .then(() => lift(Parser.string(": ")).then(() => withIndentation(blockMarkdown)))
  .many1()

const definitionList = definitionTerms
  .then(terms =>
    definitionDescriptions.map(
      (descriptions): DefinitionListItem => ({ type: "definitionListItem", terms, descriptions }),
    ),
  )
  .separatedBy1(blankLines)
  .map((content): DefinitionList => ({ type: "definitionList", content }))

const containerDelimiter = lift(Parser.string(":::"))
const containerName = lift(Parser.regex(/^\w+/))

const container: StatefulParser<Container> = containerDelimiter
  .then(() => oneOrMoreSpacesT)
  .then(() => containerName)
  .then(name =>
    blankLines
      .then(() => indentation.then(() => blockMarkdown))
      .then(content =>
        blankLines
          .then(() => indentation)
          .then(() => containerDelimiter)
          .map(() => ({ type: "container", name, content })),
      ),
  )

const footnote: StatefulParser<Footnote> = lift(footnoteRef).then(ref =>
  lift(Parser.string(":"))
    .then(() => oneOrMoreSpacesT)
    .then(() => withIndentation(blockMarkdown))
    .map(content => ({
      type: "footnote",
      label: ref.label,
      content,
    })),
)

const tableHeaderSeparatorCell = lift(Parser.regex(/^:?-+:?/))
const tableSectionWithSubheaderSeparatorCell = lift(Parser.regex(/^={3,}/))
const tableSectionSeparatorCell = lift(Parser.regex(/^-{3,}/))
const getAlignmentFromSeparator = (separator: string): TableColumnStyle["alignment"] => {
  const left = separator.startsWith(":")
  const right = separator.endsWith(":")
  return left ? (right ? "center" : "left") : right ? "right" : undefined
}
const tableSeparator = StateTParser.string<S>("|")
const tableContentCellGuard = StateTParser.lookahead(StateTParser.regex<S>(/^ *\w+/u))
const tableRow = <T>(parser: StatefulParser<T>): StatefulParser<T[]> =>
  tableSeparator
    .htoken()
    .then(() => parser.separatedBy1(tableSeparator.htoken()))
    .then(header => tableSeparator.map(() => header))

const tableCaptionRow = StateTParser.string<S>("|#")
  .htoken()
  .then(() => inlineNodesT.htoken())
  .then(caption =>
    StateTParser.string<S>("#|")
      .htoken()
      .then(() => newlineT)
      .map(() => caption),
  )
  .optional()

const tableHeaderRow = tableRow(tableContentCellGuard.then(() => inlineNodesT))
const tableSeparatorRow = tableRow(tableHeaderSeparatorCell)
const tableSectionNormalRow = tableRow(
  tableContentCellGuard
    .then(() => inlineNodesT)
    .htoken()
    .then(content =>
      StateTParser.lookahead(StateTParser.string<S>("||"))
        .then(() => StateTParser.string("|"))
        .many()
        .map(span => ({ content, span: span.length > 0 ? span.length + 1 : undefined })),
    ),
)
const tableSectionWithSubheaderSeparatorRow = tableRow(tableSectionWithSubheaderSeparatorCell)
const tableSectionSubheaderWithSeparatorRow = tableSectionWithSubheaderSeparatorRow
  .then(() => newlineT)
  .then(() => tableSectionNormalRow)
  .map(header => ({
    type: "newSection" as const,
    header,
  }))
const tableSectionPlainSeparatorRow = tableRow(tableSectionSeparatorCell).map(() => ({
  type: "newSection" as const,
}))
const tableBodyRow = tableSectionSubheaderWithSeparatorRow
  .orFirstW(tableSectionPlainSeparatorRow)
  .orFirstW(tableSectionNormalRow)

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

const finalBlockMarkdown: StatefulParser<BlockMarkdownNode[] | undefined> = blockMarkdown
  .then(result => anyWhitespaceT.map(() => result))
  .optional()

export const parseBlockMarkdown = (syntax: string): BlockMarkdownNode[] => {
  const results = finalBlockMarkdown.evalT({ indentation: 0 }).apply(syntax)

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
