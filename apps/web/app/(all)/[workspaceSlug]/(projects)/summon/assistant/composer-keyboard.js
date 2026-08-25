/**
 * @param {{ key: string; shiftKey: boolean; isComposing: boolean }} event
 */
export function shouldSubmitAssistantComposer(event) {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}
