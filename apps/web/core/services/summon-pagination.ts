type TCursorPage<T> = {
  results: T[] | unknown;
  next_cursor?: string;
  next_page_results?: boolean;
};

export async function listAllCursorResults<T>(fetchPage: (cursor?: string) => Promise<TCursorPage<T>>): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;
  do {
    // eslint-disable-next-line no-await-in-loop -- each cursor depends on the previous response.
    const page = await fetchPage(cursor);
    if (Array.isArray(page.results)) results.push(...page.results);
    cursor = page.next_page_results ? page.next_cursor : undefined;
  } while (cursor);
  return results;
}
