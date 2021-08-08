import buildWhereClause from './buildWhereClause'

const buildUpdate =  (postgres: any) => async (table: string, { updates, where, values }: { updates: any, where: Function, values: any }) => {
	
	//Avoid accidental updates to all records by requiring a where clause
	if (!where){
		return Promise.reject({ error: 'WHERE clause required for all update queries. If you want to update all records set where = true' })
	}
	
	const valuesArray = Object.values(updates)
	
	let whereClause = where
	
	//If the user passed a builde function for the WHERE clause use that to build it
	if (typeof where === 'function'){

		const whereParams = buildWhereClause({ builder: where, values, offset: valuesArray.length })
		
		whereClause = whereParams.whereClause
		valuesArray.push(...whereParams.values)
	}

	const keys = Object.keys(updates)
	let columnList = ''

	keys.forEach((k, i) => {
		
		columnList = columnList + `"${k}"` + ` = $${i+1}`
		
		if (i < keys.length - 1) {
			columnList = columnList + ', '
		}
	})
	
	const queryString = `UPDATE "${table}" SET ${columnList} WHERE ${whereClause} RETURNING *`
	
	const dbRes = await postgres.query(queryString, valuesArray)
	
	return dbRes
}

export default buildUpdate