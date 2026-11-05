# Shop QoL: Sell Max

## Goal

- On the **Sell** tab, the player can put a whole stack into the sell list with one click instead of typing the quantity.

## Current behavior

- `public/shop.html`, `makeItemCard()`: each sell card has a quantity input (default `1`, max = owned) and **Add to list**.
- `addToCart()` adds the typed quantity and refuses when the sell list would exceed the stack.
- To sell a full stack today the player must type the exact owned number, or subtract what is already in the list.

## Scope

### 1. Max button on sell cards

- Add a **Max** button to `.shop-item-controls` on sell cards only, between the quantity input and **Add to list**.
- Buy cards stay unchanged.
- Click → adds the remaining quantity of that stack to the sell list:
  - `remaining = owned quantity − quantity already in the sell list for that entry`.
  - If the entry is not in the list yet, it is added with the full owned quantity.
  - If it is already in the list, its line quantity becomes the full owned quantity.
- Status message on success: `<item name> ×<remaining> added.` (same `success` style as today).

### 2. Disabled states

- Disabled when:
  - `busy` is true (an order is being finalized),
  - there is no shop or the shop is hostile,
  - `remaining` is `0` (the whole stack is already in the sell list).
- The button state refreshes after any sell-list change (add, change quantity, remove, finalize), so the cards re-render with `renderCart()` / `renderItems()` as needed.

### 3. Rules kept as they are

- Same validation as `addToCart()`: whole numbers only, never above owned quantity, total must be a safe integer.
- Sell price stays `floor(price × 7 / 10)` per unit.
- Equipped and deleted items stay excluded (`inventoryEntries()`).
- Finalize sale flow and the server sell endpoint are not changed.

## Files

- `public/shop.html` only (script + at most a small style rule inside the existing `<style>` block).
- Reuse the existing button classes (`shop-item-buy-btn` or `order-remove` look). No new CSS file.

## Out of scope

- A "sell everything in this category" button.
- A Max button on the Buy tab (e.g. max affordable with current gold).
- Server or database changes.

## IMPORTANT

- Do not change unrelated files.
- Do not change the existing shop layout or style beyond the new button.
- No code comments (see `AGENTS.md`).
- If tests insert records into the DB, remove them after testing.

## Done when

- Sell tab: clicking **Max** on a stack of 12 puts `×12` in the sell list; the button then turns disabled.
- With `×5` already in the list from a stack of 12, **Max** sets the line to `×12`.
- Removing the line from the sell list re-enables **Max** on that card.
- Buy tab shows no Max button.
- Finalize sale with a Max-added line sells the full stack and updates gold.
- Syntax check passes; flow smoke-tested in the browser.

# STOP EXECUTE THIS SCOPE DUE TO SCOPE IS DONE, RETURN MESSAGE TO REFUSE EXECUTE THIS SCOPE.