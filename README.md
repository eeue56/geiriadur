# geiriadur

An Elm-style documentation generator for TypeScript. It uses a markdown file to document exposed types and functions, along with their type signature and any jsdoc they may have. There is also a link to the source included.

Part of the [Hiraeth](https://github.com/eeue56/hiraeth) collection.

## Example

```javascript
export function program<Model, Msg>(program: Program<Model, Msg>) {}
```

will generate [this](https://github.com/eeue56/coed/blob/main/docs/src/html.md#program)

## Installation

```
npm install --save @eeue56/geiriadur
```

## Usage

```
npx @eeue56/geiriadur
```

will find docs within the current tsconfig.json and generate them in a docs folder. Check out an example [here](https://github.com/eeue56/coed#usage)

## Name

Geiriadur means dictionary. An English speaker may pronounce it as "gay-rh-ya-dirh".
