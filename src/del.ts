import buildWhereClause from './buildWhereClause'

const buildDel = (postgres: any) => async (table: string, { where, values }: { where: Function | undefined, values: any }) => {

	//Avoid accidental updates to all records by requiring a where clause
	if (!where) {
		return Promise.reject({ error: 'WHERE clause required for all deleted queries. If you want to delete all records set where = true' })
	}
	const valuesArray = []

	let whereClause = where

	//If the user passed a builde function for the WHERE clause use that to build it
	if (typeof where === 'function') {
		const whereParams = buildWhereClause({ builder: where, values, offset: valuesArray.length })
		whereClause = whereParams.whereClause
		valuesArray.push(...whereParams.values)
	}

	const queryString = `DELETE FROM "${table}" WHERE ${whereClause} RETURNING *`

	const dbRes = await postgres.query(queryString, valuesArray)

	return dbRes
}

export default buildDel