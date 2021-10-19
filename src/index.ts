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
		columns: {
			[column: string]: idHandler[]
		},
		handlers: Function[]
	},
}

interface middlewareEvent {
	table: string,
	params: any,
	result?: any,
	stop?: Function
}
const validFunctions = {
	beforeInsert: 'beforeInsert',
	afterInsert: 'afterInsert',
	beforeUpdate: 'beforeInsert',
	afterUpdate: 'afterInsert'
} as const


class DatabaseDriver {
	postgres: any
	query: (qs: String) => any
	insert: (table: string, rows: any | any[], disableTransaction?: Boolean) => any
	_insert: (table: string, rows: any | any[], disableTransaction?: Boolean) => any
	update: (table: string, { updates, where, values }: { updates: any, where: Function, values: any }) => any
	_update: (table: string, { updates, where, values }: { updates: any, where: Function, values: any }) => any
	del: (table: string, { where, values }: { where: Function | undefined, values: any }) => any
	_del: (table: string, { where, values }: { where: Function | undefined, values: any }) => any

	// Middleware functions types

	_middlewareFunctions: {
		beforeInsert: tableNameColumnAndHandlerMiddleWare,
		afterInsert: tableNameColumnAndHandlerMiddleWare,

		beforeUpdate: tableNameColumnAndHandlerMiddleWare,
		afterUpdate: tableNameColumnAndHandlerMiddleWare

		beforeDelete: tableNameAndHandlerMiddleWare,
		afterDelete: tableNameAndHandlerMiddleWare,
	}

	beforeInsert: (tableName: string, a: string[] | Function[], b?: Function | Function[]) => any
	afterInsert: (tableName: string, a: string[] | Function[], b?: Function | Function[]) => any

	beforeUpdate: (tableName: string, a: string[] | Function[], b?: Function | Function[]) => any
	afterUpdate: (tableName: string, a: string[] | Function[], b?: Function | Function[]) => any

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
	_filterDuplicates: (arr: idHandler[]) => Function[] = (arr) => {
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
	_interateMiddlewareFunctions: (event: middlewareEvent) => (handlers: Function[]) => any = (event) => async (handlers = []) => {
		const interate = async (index: number) => {
			if (!handlers[index]) {
				return
			}
			await handlers[index](event)
			await interate(index + 1)
		}
		return interate(0)
	}
	_insertHandlers: (key: keyof typeof validFunctions, tableName: string, a: string[] | Function[], b?: Function | Function[]) => any = (key, tableName, a, b) => {
		a = Array.isArray(a) ? a : [a]
		if (b) {
			let columns = (a as any[]).filter((element: any) => typeof element == 'string')
			let handlers = Array.isArray(b) ? b : [b]
			this._insertColumnHandlers(key, tableName, columns, handlers)
		} else {
			let handlers = (a as any[]).filter((element: any) => typeof element == 'function')
			this._insertTableHandlers(key, tableName, handlers)
		}
	}
	_insertColumnHandlers: (key: keyof typeof validFunctions, tableName: string, columns: string | string[], handlers: Function | Function[]) => void = (key, tableName, columns, handlers) => {
		const handlersToAdd = this._validateHandlers(handlers).map(handler => {
			return {
				id: uuid(),
				handler
			}
		})
		if (!this._middlewareFunctions[key][tableName]) {
			this._middlewareFunctions[key][tableName] = {
				columns: {},
				handlers: []
			}
		}
		if (!Array.isArray(columns)) {
			columns = [columns]
		}
		columns.map(column => {
			if (!this._middlewareFunctions[key][tableName].columns[column]) {
				this._middlewareFunctions[key][tableName].columns[column] = []
			}
			this._middlewareFunctions[key][tableName].columns[column].push(...handlersToAdd)
		})
	}
	_insertTableHandlers: (key: keyof typeof validFunctions, tableName: string, handlers: Function | Function[]) => void = (key, tableName, handlers) => {
		const handlersToAdd = this._validateHandlers(handlers)
		if (!this._middlewareFunctions[key][tableName]) {
			this._middlewareFunctions[key][tableName] = {
				columns: {},
				handlers: []
			}
		}
		this._middlewareFunctions[key][tableName].handlers.push(...handlersToAdd)
	}
	_buildHandlers: (key: keyof typeof validFunctions, table: string, columns: string[]) => Function[] = (key, table, columns) => {
		const eventHandlers: idHandler[] = []
		columns.map(column => {
			const columnSpecificBeforeHandlers = this._middlewareFunctions[key][table] && this._middlewareFunctions[key][table].columns && this._middlewareFunctions[key][table].columns[column]
			if (columnSpecificBeforeHandlers) {
				eventHandlers.push(...columnSpecificBeforeHandlers)
			}
		})
		const finalHandlers: Function[] = []
		const tableHandlers = this._middlewareFunctions[key][table] && this._middlewareFunctions[key][table].handlers
		if (tableHandlers) {
			finalHandlers.push(...tableHandlers)
		}
		finalHandlers.push(...this._filterDuplicates(eventHandlers))
		return finalHandlers
	}

	constructor(postgres: Client | Pool) {
		this.postgres = postgres
		this._insert = buildInsert(postgres)
		this.insert = async (table, params, disableTransaction) => {
			params = Array.isArray(params) ? params : [params]
			const uniqueKeyMap: any = {}
			params.map((element: any) => {
				Object.keys(element).map((key: string) => {
					uniqueKeyMap[key] = true
				})
			})
			const beforeInsertHandlers: Function[] = this._buildHandlers('beforeInsert', table, Object.keys(uniqueKeyMap))
			const afterInsertHandlers: Function[] = this._buildHandlers('afterInsert', table, Object.keys(uniqueKeyMap))

			const event: middlewareEvent = {
				table,
				params,
				result: null,
				stop: (reason: any) => {
					throw reason
				}
			}
			await this._interateMiddlewareFunctions(event)(beforeInsertHandlers)
			const res = await this._insert(event.table, event.params, disableTransaction)
			delete event.stop
			event.result = res
			await this._interateMiddlewareFunctions(event)(afterInsertHandlers)
			return res
		}
		this._update = buildUpdate(postgres)
		this.update = async (table, params) => {
			const beforeUpdateHandlers: Function[] = this._buildHandlers('beforeUpdate', table, Object.keys(params.updates))
			const afterUpdateHandlers: Function[] = this._buildHandlers('afterUpdate', table, Object.keys(params.updates))
			const event: middlewareEvent = {
				table,
				params,
				result: null,
				stop: (reason: any) => {
					throw reason
				}
			}
			await this._interateMiddlewareFunctions(event)(beforeUpdateHandlers)
			const res = await this._update(event.table, event.params)
			delete event.stop
			event.result = res
			await this._interateMiddlewareFunctions(event)(afterUpdateHandlers)
			return res
		}
		this._del = buildDel(postgres)
		this.del = async (table, params) => {
			const event: middlewareEvent = {
				table,
				params,
				result: null,
				stop: (reason: any) => {
					throw reason
				}
			}
			await this._interateMiddlewareFunctions(event)(this._middlewareFunctions.beforeDelete[table])
			const res = await this._del(event.table, event.params)
			delete event.stop
			event.result = res
			await this._interateMiddlewareFunctions(event)(this._middlewareFunctions.afterDelete[table])
			return res
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

		this.beforeInsert = (tableName, a, b) => {
			this._insertHandlers('beforeInsert', tableName, a, b)
		}
		this.afterInsert = (tableName, a, b) => {
			this._insertHandlers('afterInsert', tableName, a, b)
		}

		this.beforeUpdate = (tableName, a, b) => {
			this._insertHandlers('beforeUpdate', tableName, a, b)
		}
		this.afterUpdate = (tableName, a, b) => {
			this._insertHandlers('afterUpdate', tableName, a, b)
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