import buildInsert from './insert'
import buildUpdate from './update'
import buildDel from './del'

class DatabaseDriver{
	postgres: any
	query: (qs:String) => any
	insert: (table: string, rows: any | any[]) => any
	del: (table: string, { where, values }: { where: Function | undefined, values: any }) => any
	update: (table: string, { updates, where, values }: { updates: any, where: Function, values: any }) => any
	
	constructor(postgres:any){
		this.postgres = postgres
		this.insert = buildInsert(postgres)
		this.del = buildDel(postgres)
		this.update = buildUpdate(postgres)
		this.query = this.postgres.query
	}
}

export default DatabaseDriver