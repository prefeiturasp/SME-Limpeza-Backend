'user strict';

const camelcaseKeysDeep = require('camelcase-keys-deep');

const { Client, Pool } = require('pg');

exports.query = query;
exports.findOne = findOne;
exports.findAll = findAll;
exports.insertWithReturn = insertWithReturn;
exports.iniciarTransaction = iniciarTransaction;
exports.finalizarTransaction = finalizarTransaction;

const pool = new Pool({
	host: process.env.PG_HOST,
	port: process.env.PG_PORT,
	database: process.env.PG_DATABASE,
	user: process.env.PG_USER,
	password: process.env.PG_PASSWORD,
	//ssl: { rejectUnauthorized: false }
});

async function iniciarTransaction() {

	try {
		var client = await pool.connect();
		await client.query('BEGIN');
		return client;
	} catch (error) {
		console.log('Erro ao iniciar transação...');
		throw new Error(error);
	}

}

async function finalizarTransaction(status, conn) {

	try {
		await conn.query(status ? 'COMMIT' : 'ROLLBACK');
		conn.release();
		return true;
	} catch (error) {
		console.log('Erro ao finalizar transação...');
		throw new Error(error);
	}

}

async function query(sql, values, conn) {

	const client = conn ? conn : await pool.connect();

	try {
		const response = await client.query(sql, values);
		return camelcaseKeysDeep(response);
	} finally {
		if (!conn) client.release();
	}

}

async function insertWithReturn(sql, values, columnReturn, conn) {

	const client = conn ? conn : await pool.connect();

	try {
		var sql = sql + ' RETURNING ' + columnReturn;
		const response = await client.query(sql, values);
		return camelcaseKeysDeep(response.rows[0][columnReturn]);
	} finally {
		if (!conn) client.release();
	}

}

async function findAll(sql, values, conn) {

	const client = conn ? conn : await pool.connect();

	try {
		const response = await client.query(sql, values);
		return camelcaseKeysDeep(response.rows);
	} finally {
		if (!conn) client.release();
	}

}

async function findOne(sql, values, conn) {

	const client = conn ? conn : await pool.connect();

	try {
		const response = await client.query(sql, values);
		return camelcaseKeysDeep(response.rows[0]);
	} finally {
		if (!conn) client.release();
	}

}