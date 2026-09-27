import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useConvex, useQueries } from "convex/react";
import { UserRound } from "lucide-react";
import type { TMentionHandler } from "@plane/editor";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { memberLabel } from "../commercial/member-label";

const MentionContext = createContext({
  register:
    (_id: string): (() => void) =>
    () => {},
  labels: new Map<string, string>(),
});
export function DocumentMentionsProvider({
  documentId,
  children,
}: {
  documentId: Id<"documents">;
  children: ReactNode;
}) {
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map());
  const register = useCallback((id: string) => {
    setCounts((previous) => new Map(previous).set(id, (previous.get(id) ?? 0) + 1));
    return () =>
      setCounts((previous) => {
        const next = new Map(previous),
          count = (next.get(id) ?? 1) - 1;
        if (count) next.set(id, count);
        else next.delete(id);
        return next;
      });
  }, []);
  const queries = useMemo(() => {
    const ids = [...counts.keys()];
    return Object.fromEntries(
      Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => {
        const userIds = ids.slice(index * 100, (index + 1) * 100);
        return [String(index), { query: api.documents.mentions.resolve, args: { documentId, userIds } }];
      })
    );
  }, [counts, documentId]);
  const results: Record<string, FunctionReturnType<typeof api.documents.mentions.resolve> | Error | undefined> =
    useQueries(queries);
  const value = useMemo(() => {
    const labels = new Map<string, string>();
    for (const result of Object.values(results)) {
      if (result instanceof Error) throw result;
      for (const row of result ?? []) labels.set(row.id, memberLabel(row.member));
    }
    return { register, labels };
  }, [results, register]);
  return <MentionContext.Provider value={value}>{children}</MentionContext.Provider>;
}
function UserMention({ userId }: { userId: string }) {
  const { register, labels } = useContext(MentionContext);
  useEffect(() => register(userId), [register, userId]);
  return (
    <span className="not-prose inline rounded-sm bg-accent-subtle-active px-1 py-0.5 text-accent-primary">
      @{labels.get(userId) ?? "Loading member…"}
    </span>
  );
}
export function useDocumentMentions(documentId: Id<"documents">) {
  const client = useConvex();
  return useMemo(
    () =>
      ({
        renderComponent: ({ entity_name, entity_identifier }) =>
          entity_name === "user_mention" ? (
            <UserMention userId={entity_identifier} />
          ) : (
            <span className="not-prose inline rounded-sm bg-layer-1 px-1 text-secondary">@Unsupported mention</span>
          ),
        searchPageCallback: async (search, cursor) => {
          const page = await client.query(api.documents.mentions.search, {
            documentId,
            search,
            paginationOpts: { cursor, numItems: 30 },
          });
          return {
            cursor: page.isDone ? null : page.continueCursor,
            sections: page.page.length
              ? [
                  {
                    key: cursor ?? "members",
                    title: "Workspace members",
                    items: page.page.map((member) => ({
                      id: member.id,
                      entity_identifier: member.id,
                      entity_name: "user_mention" as const,
                      title: memberLabel(member),
                      subTitle: member.name && member.email ? member.email : undefined,
                      icon: <UserRound className="size-4" />,
                    })),
                  },
                ]
              : [],
          };
        },
      }) satisfies TMentionHandler,
    [client, documentId]
  );
}
