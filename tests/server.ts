import DatabaseDriver from '../src'

const {insert, update, del} = new DatabaseDriver({})

insert('table', [])