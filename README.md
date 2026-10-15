# @vadymecum/cursor-typings

Types and JSON Schema for [Cursor hooks](https://cursor.com/docs/hooks).

```sh
pnpm add -D @vadymecum/cursor-typings
```

## Types

```ts
import type { HookHandler } from '@vadymecum/cursor-typings';

export const handler: HookHandler<'beforeShellExecution'> = (input) => ({
  permission: input.command.includes('rm -rf') ? 'deny' : 'allow',
});
```

## Schema

`.cursor/hooks.json`:

```json
{
  "$schema": "https://unpkg.com/@vadymecum/cursor-typings/hooks.schema.json",
  "version": 1,
  "hooks": {}
}
```

Or in editor settings:

```json
"json.schemas": [{
  "fileMatch": [".cursor/hooks.json"],
  "url": "https://unpkg.com/@vadymecum/cursor-typings/hooks.schema.json"
}]
```



## License

MIT