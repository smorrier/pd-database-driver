const buildInsert = (postgres:any) => async (table: string, rows: any | any[], disableTransaction?: Boolean) => {
	//Accept rows as a single row ( {} ) or an array or rows ( [{},{}] )
	let data = rows

	if (!Array.isArray(rows)) {
		data = [rows]
	}
	try {
		if (!disableTransaction) {
			await postgres.query('BEGIN')
		}
		const insertedRows = []
		const errorRows = []

		for (const r of data) {

			const keys = Object.keys(r)
			let columnList = ''
			let valuePlaceHolders = ''

			keys.forEach((k, i) => {
				columnList = columnList + '"' + k + '"'
				valuePlaceHolders = valuePlaceHolders + `$${i + 1}`

				if (i < keys.length - 1) {
					columnList = columnList + ', '
					valuePlaceHolders = valuePlaceHolders + ', '
				}
			})

			const values = Object.values(r)
			const queryString = `INSERT INTO "${table}"(${columnList}) VALUES(${valuePlaceHolders}) RETURNING *`

			try {
				const dbRes = await postgres.query(queryString, values)
				insertedRows.push(dbRes.rows[0])

			} catch (err) {
				errorRows.push({ row: r, error: err })
			}

		}
		
		if (errorRows.length) {
			if (!disableTransaction) {
				await postgres.query('ROLLBACK')
			}
			return Promise.reject({ errorRows })
		} else {
			if (!disableTransaction) {
				await postgres.query('COMMIT')
			}
			return { insertedRows }
		}
	} catch (e) {
		return { status: 500, error: 'something went wrong!' }
	}
}

export default buildInsert