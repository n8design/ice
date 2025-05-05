# SCSS Processing in ICE Build

ICE Build provides robust SCSS compilation capabilities with automatic vendor prefixing using autoprefixer.

## Autoprefixer Configuration

ICE Build uses standard browserslist configuration discovery for autoprefixer. This means it will automatically find and use:

1. A `browserslist` field in your package.json
2. A `.browserslistrc` file in your project root
3. The `BROWSERSLIST` environment variable

If none of these are found, autoprefixer will use its default setting: `> 0.5%, last 2 versions, Firefox ESR, not dead`.

### Customizing Browser Support

#### Using package.json:
```json
{
  "browserslist": [">0.3%", "last 2 versions", "not dead"]
}
```

#### Using .browserslistrc file:
```
