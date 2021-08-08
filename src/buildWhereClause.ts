interface BuildWhereParams {
  builder: Function;
  values: any[];
  offset: number;
}

export default function buildWhereClause({ builder, values, offset }: BuildWhereParams){
	if (!values){
		throw new Error('Missing values for WHERE clause builder')
	}
	
	const keys = Object.keys(values)
	
	const param: any = {}
	const valueList = Object.values(values)
	
	keys.forEach((k,i) => {
		if (values[k as keyof typeof keys] === undefined){
			throw new Error('Missing value for ' + k)
		}
		param[k as keyof typeof param] = `$${i + 1 + offset}`
	})
	
	const whereClause = builder(param)
	
	return {
		whereClause,
		values: valueList
	}
}