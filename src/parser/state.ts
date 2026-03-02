import type { StateTParser } from "@elyukai/utils/stateParser"

export type S = {
  indentation: number
  keepSyntax: boolean
}

export type StatefulParser<T> = StateTParser<S, T>
