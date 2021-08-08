
# PG Database Driver by Cion Studio

Simple CRUD query builders for postgres

## Requirements
- npm and NodeJS
	- Download and Install nodeJs
    - [https://nodejs.org/en/](https://nodejs.org/en/)

## Usage with Node

```
import DatabaseDriver from 'pg-database-driver'
import { Client } from 'pg'

const postgres = new Client({
	user: process.env.POSTGRES_USER as string,
	host: process.env.POSTGRES_HOSTNAME as string,
	database: process.env.POSTGRES_DB as string,
	password: process.env.POSTGRES_PASSWORD as string,
	port: process.env.POSTGRES_PORT as number | undefined,
})

const { update, del, insert, query } = new DatabaseDriver(postgres)

export { postgres, insert, update, del, query }

```


## Development

#### Recommended VS Code extensions:
* ES Lint
