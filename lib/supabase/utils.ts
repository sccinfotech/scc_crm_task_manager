/**
 * Escapes special characters for PostgreSQL ILIKE queries.
 * Prevents %, _ and \ from being interpreted as wildcards.
 */
export function escapeLike(term: string): string {
    return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Standardizes search term processing: trimmed and escaped.
 */
export function prepareSearchTerm(term: string | null | undefined): string | null {
    const trimmed = term?.trim()
    if (!trimmed) return null
    return escapeLike(trimmed)
}
