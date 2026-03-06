import { StateTParser } from "@elyukai/utils/stateParser"

export type S = {
  indentation: number
  keepSyntax: boolean
}

export type StatefulParser<T> = StateTParser<S, T>

/**
 * Passed a parser for specific syntax, returns a parser that conditionally keeps the syntax in the parsed result based on the `keepSyntax` property of the parser state.
 */
export const syntax = <T>(parser: StatefulParser<T>): StatefulParser<T | undefined> =>
  StateTParser.getsT((state: S) => state.keepSyntax).then(keepSyntax =>
    parser.map(result => (keepSyntax ? result : undefined)),
  )

export const getSyntaxSetting = StateTParser.getsT((state: S) => state.keepSyntax)
