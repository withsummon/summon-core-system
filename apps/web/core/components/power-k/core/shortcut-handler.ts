/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IPowerKCommandRegistry } from "./registry";
import type { TPowerKCommandConfig, TPowerKContext } from "./types";

/**
 * Formats a keyboard event into a modifier shortcut string
 * e.g., "cmd+k", "cmd+shift+,", "cmd+delete"
 */
export function formatModifierShortcut(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push("cmd");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");

  const key = e.key.toLowerCase();
  parts.push(key === " " ? "space" : key);

  return parts.join("+");
}

/**
 * Checks if the event target is a typing-focused element
 */
export function isTypingInInput(target: EventTarget | null): boolean {
  if (!target) return false;

  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;

  if (!(target instanceof Element)) return false;
  if (target.classList.contains("ProseMirror")) return true;
  if (target.getAttribute("contenteditable") === "true") return true;

  return false;
}

/** Shared sequence lifetime for legacy and native command owners. */
export class KeySequenceHandler {
  private sequence = "";
  private sequenceTimeout: number | null = null;
  constructor(private match: (sequence: string, event: KeyboardEvent) => boolean) {}

  handleKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    this.sequence += key;

    if (this.match(this.sequence, e)) {
      this.resetSequence();
      return;
    }

    this.scheduleSequenceReset();
  }

  private scheduleSequenceReset(): void {
    if (this.sequenceTimeout) {
      window.clearTimeout(this.sequenceTimeout);
    }

    this.sequenceTimeout = window.setTimeout(() => {
      this.resetSequence();
    }, 1000);
  }

  private resetSequence(): void {
    this.sequence = "";
    if (this.sequenceTimeout) {
      window.clearTimeout(this.sequenceTimeout);
      this.sequenceTimeout = null;
    }
  }

  destroy(): void {
    this.resetSequence();
  }
}

/**
 * Global shortcut handler
 * Handles all keyboard shortcuts: single keys, sequences, and modifiers
 */
export class ShortcutHandler {
  private keySequence: KeySequenceHandler;
  private registry: IPowerKCommandRegistry;
  private getContext: () => TPowerKContext;
  private openPalette: () => void;
  private isEnabled = true;

  constructor(registry: IPowerKCommandRegistry, getContext: () => TPowerKContext, openPalette: () => void) {
    this.registry = registry;
    this.getContext = getContext;
    this.openPalette = openPalette;
    this.keySequence = new KeySequenceHandler((sequence, e) => {
      // Check if sequence matches a command (e.g., "gm", "op")
      const sequenceCommand = this.registry.findByKeySequence(this.getContext(), sequence);
      if (sequenceCommand && this.canExecuteCommand(sequenceCommand)) {
        e.preventDefault();
        this.executeCommand(sequenceCommand);
        return true;
      }

      // If sequence is one character, check for single-key shortcut
      if (sequence.length === 1) {
        const singleKeyCommand = this.registry.findByShortcut(this.getContext(), sequence);
        if (singleKeyCommand && this.canExecuteCommand(singleKeyCommand)) {
          e.preventDefault();
          this.executeCommand(singleKeyCommand);
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Enable/disable the shortcut handler
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Main keyboard event handler
   */
  handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.isEnabled) return;

    const key = e.key.toLowerCase();
    const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;

    // Special: Cmd+K always opens command palette
    if ((e.metaKey || e.ctrlKey) && key === "k") {
      e.preventDefault();
      this.openPalette();
      return;
    }

    // Don't handle shortcuts when typing in inputs (except Cmd+K)
    if (isTypingInInput(e.target)) {
      return;
    }

    // Handle modifier shortcuts (Cmd+Delete, Cmd+Shift+,, etc.)
    if (hasModifier) {
      this.handleModifierShortcut(e);
      return;
    }

    // Handle single key shortcuts and sequences (c, p, gm, op, etc.)
    this.keySequence.handleKeyDown(e);
  };

  /**
   * Handle modifier shortcuts (Cmd+X, Cmd+Shift+X, etc.)
   */
  private handleModifierShortcut(e: KeyboardEvent): void {
    const shortcut = formatModifierShortcut(e);
    const command = this.registry.findByModifierShortcut(this.getContext(), shortcut);

    if (command && this.canExecuteCommand(command)) {
      e.preventDefault();
      this.executeCommand(command);
    }
  }

  /**
   * Check if command can be executed
   */
  private canExecuteCommand(command: TPowerKCommandConfig): boolean {
    const ctx = this.getContext();

    // Check visibility
    if (command.isVisible && !command.isVisible(ctx)) {
      return false;
    }

    // Check enablement
    if (command.isEnabled && !command.isEnabled(ctx)) {
      return false;
    }

    // Check context type requirement
    if ("contextType" in command) {
      if (!ctx.activeContext || ctx.activeContext !== command.contextType) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a command
   */
  private executeCommand(command: TPowerKCommandConfig): void {
    const ctx = this.getContext();

    if (command.type === "action") {
      // Direct action
      command.action(ctx);
    } else if (command.type === "change-page") {
      // Opens a selection page - open palette and set active page
      this.openPalette();
      ctx.setActiveCommand(command);
      ctx.setActivePage(command.page);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.keySequence.destroy();
    this.isEnabled = false;
  }
}
