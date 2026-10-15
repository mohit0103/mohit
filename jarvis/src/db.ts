// The free plan allows 50 D1 queries per invocation. This wrapper counts them so optional work can wait for a later tick.

export type CountedD1 = D1Database & { used: number };

export function countQueries(db: D1Database): CountedD1 {
	const counter = { used: 0 };
	const original = new WeakMap<object, D1PreparedStatement>();
	const wrap = (stmt: D1PreparedStatement): D1PreparedStatement => {
		const p = new Proxy(stmt, {
			get(target, prop) {
				const v = (target as any)[prop];
				if (prop === 'bind') return (...args: unknown[]) => wrap(v.apply(target, args));
				if (prop === 'first' || prop === 'all' || prop === 'run' || prop === 'raw')
					return (...args: unknown[]) => {
						counter.used++;
						return v.apply(target, args);
					};
				return typeof v === 'function' ? v.bind(target) : v;
			},
		});
		original.set(p, stmt);
		return p;
	};
	return new Proxy(db as CountedD1, {
		get(target, prop) {
			if (prop === 'used') return counter.used;
			const v = (target as any)[prop];
			if (prop === 'prepare') return (sql: string) => wrap(v.call(target, sql));
			if (prop === 'batch')
				return (stmts: D1PreparedStatement[]) => {
					counter.used += stmts.length;
					return v.call(target, stmts.map((st) => original.get(st) ?? st)); // the real statements, not our wrappers
				};
			return typeof v === 'function' ? v.bind(target) : v;
		},
	});
}

/** Queries used so far in this invocation (0 when the database isn't counted, e.g. in tests). */
export function queriesUsed(db: D1Database): number {
	return Number((db as Partial<CountedD1>).used ?? 0);
}

export const QUERY_LIMIT = 50;
