/* eslint-disable indent */
import DatabaseDriver from '../src'

const { Client } = require('pg')
const postgres = new Client({
    user: 'cion-dev',
    host: 'localhost',
    database: 'public2',
    password: 'cionDevDB',
    port: 5432,
})

postgres.connect()
const databaseDriver = new DatabaseDriver(postgres)
// Insert Tests

databaseDriver.beforeInsert('test', (...args: any) => {
    console.log('insert1', ...args)
})
databaseDriver.beforeInsert('test', [
    (...args: any) => {
        console.log('insert2', ...args)
    },
    (...args: any) => {
        console.log('insert3', ...args)
    }
])
databaseDriver.afterInsert('test', () => {
    console.log('insert4')
})
databaseDriver.afterInsert('test', [
    (...args: any) => {
        console.log('insert5', ...args)
    },
    (...args: any) => {
        console.log('insert6', ...args)
    }
])

// Delete Tests

databaseDriver.beforeDelete('test', (...args: any) => {
    console.log('delete1', ...args)
})
databaseDriver.beforeDelete('test', [
    (...args: any) => {
        console.log('delete2', ...args)
    },
    (...args: any) => {
        console.log('delete3', ...args)
    }
])
databaseDriver.afterDelete('test', () => {
    console.log('delete4')
})
databaseDriver.afterDelete('test', [
    (...args: any) => {
        console.log('delete5', ...args)
    },
    (...args: any) => {
        console.log('delete6', ...args)
    }
])

// Update Tests

databaseDriver.beforeUpdate('test', ['test1', 'test2'], (...args: any) => {
    console.log('update1')
})
databaseDriver.beforeUpdate('test', ['test1'], [
    (...args: any) => {
        console.log('update2')
    },
    (...args: any) => {
        console.log('update3')
    }
])
databaseDriver.afterUpdate('test', ['test1'], () => {
    console.log('update4')
})
databaseDriver.afterUpdate('test', ['test1', 'test2'], [
    (...args: any) => {
        console.log('update5')
    },
    (...args: any) => {
        console.log('update6')
    }
])

const test = async () => {
    await databaseDriver.update('test', {
        updates: { test1: 'asdasd', test2: 123 },
        where: (v: { test1: any }) => `"test1" =  ${v.test1}`,
        values: { test1: 'asdasd' }
    })

    await databaseDriver.insert('test', [{ test1: 'asdasd' }])

    await databaseDriver.del('test', {
        where: (v: { test1: any }) => `"test1" = ${v.test1}`,
        values: { test1: 'asdasd' }
    })

}

test()