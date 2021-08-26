import { v4 as uuid } from 'uuid'
import buildInsert from './insert'
import buildUpdate from './update'
import buildDel from './del'
import { Client, Pool } from 'pg'

interface tableNameAndHandlerMiddleWare {
	[tableName: string]: Function[],
}

interface idHandler {
	id: string,
	handler: Function
}
interface tableNameColumnAndHandlerMiddleWare {
	[tableName: string]: {
		[column: string]: idHandler[]
	},
}

class DatabaseDriver {
	postgres: any
	query: (qs: String) => any
	insert: (table: string, rows: any | any[]) => any
	_insert: (table: string, rows: any | any[]) => any
	update: (table: string, { updates, where, values }: { updates: any, where: Function, values: any }) => any
	_update: (table: string, { updates, where, values }: { updates: any, where: Function, values: any }) => any
	del: (table: string, { where, values }: { where: Function | undefined, values: any }) => any
	_del: (table: string, { where, values }: { where: Function | undefined, values: any }) => any

	// Middleware functions types

	_middlewareFunctions: {
		beforeInsert: tableNameAndHandlerMiddleWare,
		afterInsert: tableNameAndHandlerMiddleWare,

		beforeUpdate: tableNameColumnAndHandlerMiddleWare,
		afterUpdate: tableNameColumnAndHandlerMiddleWare

		beforeDelete: tableNameAndHandlerMiddleWare,
		afterDelete: tableNameAndHandlerMiddleWare,
	}

	beforeInsert: (tableName: string, handlers: Function | Function[]) => any
	afterInsert: (tableName: string, handlers: Function | Function[]) => any

	beforeUpdate: (tableName: string, columns: string | string[], handlers: Function | Function[]) => any
	afterUpdate: (tableName: string, columns: string | string[], handlers: Function | Function[]) => any

	beforeDelete: (tableName: string, handlers: Function | Function[]) => any
	afterDelete: (tableName: string, handlers: Function | Function[]) => any
	_validateHandlers: (handlers: Function | Function[]) => Function[] = (handlers) => {
		const handlersToAdd: Function[] = []
		if (typeof handlers == 'function') {
			handlersToAdd.push(handlers)
		} else if (Array.isArray(handlers)) {
			handlers.map((handler: Function) => {
				if (typeof handler != 'function') {
					throw 'Handler must be a function'
				}
				handlersToAdd.push(handler)
			})

		}
		return handlersToAdd
	}
	_interateMiddlewareFunctions: (...args: any) => (handlers?: Function[]) => any = (...args) => async (handlers) => {
		const interate = async (index: number) => {
			if (!handlers?.[index]) {
				return
			}
			await handlers[index](...args)
			console.log(index)
			await interate(index + 1)
		}
		return interate(0)
	}
	constructor(postgres: Client | Pool) {
		this.postgres = postgres
		this._insert = buildInsert(postgres)
		this.insert = async (table, rows) => {
			await this._interateMiddlewareFunctions(table, rows)(this._middlewareFunctions.beforeInsert[table])
			const res = await this._insert(table, rows)
			await this._interateMiddlewareFunctions(res)(this._middlewareFunctions.afterInsert[table])
		}
		this._update = buildUpdate(postgres)
		this.update = async (table, { updates, where, values }) => {
			const beforeUpdateHandlers: idHandler[] = []
			const afterUpdateHandlers: idHandler[] = []
			Object.keys(updates).map(column => {
				const beforeHandlers = this._middlewareFunctions.beforeUpdate[table]?.[column]
				if (beforeHandlers) {
					beforeUpdateHandlers.push(...beforeHandlers)
				}
				const afterHandlers = this._middlewareFunctions.afterUpdate[table]?.[column]
				if (afterHandlers) {
					afterUpdateHandlers.push(...afterHandlers)
				}
			})
			const filterDuplicates = (arr: idHandler[]) => {
				const seen: any = {}
				return arr.filter(({ id }) => {
					if (!seen[id]) {
						seen[id] = true
						return true
					}
					return false
				}).map(({ handler }) => {
					return handler
				})
			}
			const uniqueBeforeUpdateHandlers: Function[] = filterDuplicates(beforeUpdateHandlers)
			const uniqueAfterUpdateHandlers: Function[] = filterDuplicates(afterUpdateHandlers)
			await this._interateMiddlewareFunctions(table, { updates, where, values })(uniqueBeforeUpdateHandlers)
			const res = await this._update(table, { updates, where, values })
			await this._interateMiddlewareFunctions(res)(uniqueAfterUpdateHandlers)
		}
		this._del = buildDel(postgres)
		this.del = async (table, whereAndValues) => {
			await this._interateMiddlewareFunctions(table, whereAndValues)(this._middlewareFunctions.beforeDelete[table])
			const res = await this._del(table, whereAndValues)
			await this._interateMiddlewareFunctions(res)(this._middlewareFunctions.afterDelete[table])
		}
		this.query = this.postgres.query

		// Middleware functions
		this._middlewareFunctions = {
			beforeInsert: {},
			afterInsert: {},

			beforeUpdate: {},
			afterUpdate: {},

			beforeDelete: {},
			afterDelete: {}
		}

		this.beforeInsert = (tableName, handlers) => {
			const handlersToAdd = this._validateHandlers(handlers)
			if (!this._middlewareFunctions.beforeInsert[tableName]) {
				this._middlewareFunctions.beforeInsert[tableName] = []
			}
			this._middlewareFunctions.beforeInsert[tableName].push(...handlersToAdd)
		}
		this.afterInsert = (tableName, handlers) => {
			const handlersToAdd = this._validateHandlers(handlers)
			if (!this._middlewareFunctions.afterInsert[tableName]) {
				this._middlewareFunctions.afterInsert[tableName] = []
			}
			this._middlewareFunctions.afterInsert[tableName].push(...handlersToAdd)
		}

		this.beforeUpdate = (tableName, columns, handlers) => {
			const handlersToAdd = this._validateHandlers(handlers).map(handler => {
				return {
					id: uuid(),
					handler
				}
			})
			if (!this._middlewareFunctions.beforeUpdate[tableName]) {
				this._middlewareFunctions.beforeUpdate[tableName] = {}
			}
			if (!Array.isArray(columns)) {
				columns = [columns]
			}
			columns.map(column => {
				if (!this._middlewareFunctions.beforeUpdate[tableName][column]) {
					this._middlewareFunctions.beforeUpdate[tableName][column] = []
				}
				this._middlewareFunctions.beforeUpdate[tableName][column].push(...handlersToAdd)
			})
		}
		this.afterUpdate = (tableName, columns, handlers) => {
			const handlersToAdd = this._validateHandlers(handlers).map(handler => {
				return {
					id: uuid(),
					handler
				}
			})
			if (!this._middlewareFunctions.afterUpdate[tableName]) {
				this._middlewareFunctions.afterUpdate[tableName] = {}
			}
			if (!Array.isArray(columns)) {
				columns = [columns]
			}
			columns.map(column => {
				if (!this._middlewareFunctions.afterUpdate[tableName][column]) {
					this._middlewareFunctions.afterUpdate[tableName][column] = []
				}
				this._middlewareFunctions.afterUpdate[tableName][column].push(...handlersToAdd)
			})
		}

		this.beforeDelete = (tableName, handlers) => {
			const handlersToAdd = this._validateHandlers(handlers)
			if (!this._middlewareFunctions.beforeDelete[tableName]) {
				this._middlewareFunctions.beforeDelete[tableName] = []
			}
			this._middlewareFunctions.beforeDelete[tableName].push(...handlersToAdd)
		}
		this.afterDelete = (tableName, handlers) => {
			const handlersToAdd = this._validateHandlers(handlers)
			if (!this._middlewareFunctions.afterDelete[tableName]) {
				this._middlewareFunctions.afterDelete[tableName] = []
			}
			this._middlewareFunctions.afterDelete[tableName].push(...handlersToAdd)
		}
	}
}

export default DatabaseDriver