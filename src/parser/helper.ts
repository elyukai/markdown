export type NodeToMap<N extends { type: string }> = { [Type in N["type"]]: N & { type: Type } }
