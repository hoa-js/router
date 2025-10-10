## @hoajs/router

Router middleware for Hoa.

## Installation

```bash
$ npm i @hoajs/router --save
```

## Quick Start

```js
import { Hoa } from 'hoa'
import { router } from '@hoajs/router'

const app = new Hoa()
app.extend(router())

app.get('/users/:name', async (ctx, next) => {
  ctx.res.body = `Hello, ${ctx.req.params.name}!`
})

export default app
```

## Documentation

The documentation is available on [hoa-js.com](https://hoa-js.com/middleware/router.html)

## Test (100% coverage)

```sh
$ npm test
```

## License

MIT
