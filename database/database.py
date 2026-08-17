import sqlite3

DATABASE = "investimentos.db"


def conectar():
    return sqlite3.connect(DATABASE)


def criar_banco():

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ativos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL UNIQUE,
            quantidade REAL DEFAULT 0,
            preco_medio REAL DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS dividendos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            valor REAL NOT NULL,
            data TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            tipo TEXT NOT NULL,
            quantidade REAL NOT NULL,
            preco REAL NOT NULL,
            data TEXT NOT NULL
        )
    """)

    conexao.commit()
    conexao.close()