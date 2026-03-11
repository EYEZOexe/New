# Discord Server Join Button — Design Spec

**Date:** 2026-03-11
**Status:** Approved

## Summary

Add a "Join Server" button to the Discord Link card on the dashboard. The button opens the Discord server invite link in a new tab and is only visible when the user has linked their Discord account.

## Affected File

`website/app/dashboard/components/DashboardOverview.tsx`

## Change

Inside the existing `flex flex-wrap gap-2` button row in the Discord Link card, add a third button after the "Unlink Discord" button:

```tsx
{props.isDiscordLinked ? (
  <Button
    size="sm"
    variant="outline"
    className="rounded-full"
    asChild
  >
    <a href="https://discord.gg/3FeUhdNVDU" target="_blank" rel="noopener noreferrer">
      Join Server
    </a>
  </Button>
) : null}
```

## Behavior

- Rendered only when `props.isDiscordLinked === true`
- Opens `https://discord.gg/3FeUhdNVDU` in a new tab
- `rel="noopener noreferrer"` prevents tab-napping
- Styled identically to the existing buttons (`size="sm" variant="outline" className="rounded-full"`)
- Uses shadcn `asChild` pattern to render as an `<a>` tag inside `Button`

## Non-Changes

- No new props required — `isDiscordLinked` is already passed to the component
- No controller, backend, or schema changes
- No new components
