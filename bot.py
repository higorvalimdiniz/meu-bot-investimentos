import os
import sqlite3
import asyncio
import xml.etree.ElementTree as ET

from datetime import datetime, time
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
)


# =========================================================
# CONFIGURAÇÃO
# =========================================================

load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
BRAPI_TOKEN = os.getenv("BRAPI_TOKEN")

DATABASE = "investimentos.db"

FUSO = ZoneInfo("America/Sao_Paulo")


if not TELEGRAM_TOKEN:
    raise ValueError(
        "TELEGRAM_TOKEN não encontrado no .env"
    )

if not BRAPI_TOKEN:
    raise ValueError(
        "BRAPI_TOKEN não encontrado no .env"
    )


# =========================================================
# BANCO
# =========================================================

def conectar():
    return sqlite3.connect(DATABASE)


def criar_banco():

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ativos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT UNIQUE NOT NULL,
            quantidade REAL NOT NULL DEFAULT 0,
            preco_medio REAL NOT NULL DEFAULT 0
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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS dividendos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            valor REAL NOT NULL,
            data TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alertas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            preco REAL NOT NULL,
            ativo INTEGER NOT NULL DEFAULT 1
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS configuracao (
            chave TEXT PRIMARY KEY,
            valor TEXT
        )
    """)

    conexao.commit()
    conexao.close()


# =========================================================
# FORMATAÇÃO
# =========================================================

def dinheiro(valor):

    return (
        f"R$ {valor:,.2f}"
        .replace(",", "X")
        .replace(".", ",")
        .replace("X", ".")
    )


def numero(valor):

    return f"{valor:.2f}".replace(".", ",")


def percentual(valor):

    return f"{valor:.2f}%".replace(".", ",")


# =========================================================
# BRAPI
# =========================================================

async def buscar_cotacao(ticker):

    ticker = ticker.upper()

    url = f"https://brapi.dev/api/quote/{ticker}"

    headers = {
        "Authorization": f"Bearer {BRAPI_TOKEN}"
    }

    try:

        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            resposta = await client.get(
                url,
                headers=headers
            )

            resposta.raise_for_status()

            dados = resposta.json()

        resultados = dados.get(
            "results",
            []
        )

        if not resultados:
            return None

        return resultados[0]

    except Exception as erro:

        print(
            f"Erro ao buscar {ticker}: {erro}"
        )

        return None


# =========================================================
# START
# =========================================================

async def start(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    mensagem = """
🤖 *MEU BOT DE INVESTIMENTOS V2*

Seu assistente de investimentos está online!

📊 *CARTEIRA*
/carteira

📈 *COTAÇÃO*
/cotacao BBAS3

➕ *COMPRAR*
/comprar BBAS3 10 18.38

➖ *VENDER*
/vender BBAS3 5 20

💵 *DIVIDENDO*
/dividendo BBAS3 15.50

💰 *DIVIDENDOS*
/dividendos

📰 *NOTÍCIAS*
/noticias BBAS3

📰 *NOTÍCIAS DA CARTEIRA*
/noticias

🔔 *CRIAR ALERTA*
/alerta BBAS3 18

🚨 *MEUS ALERTAS*
/alertas

❌ *REMOVER ALERTA*
/removeralerta 1

🇧🇷 *IBOV*
/ibov

📊 *RESUMO*
/resumo

📋 *HISTÓRICO*
/historico

❓ *AJUDA*
/ajuda
"""

    await update.message.reply_text(
        mensagem,
        parse_mode="Markdown"
    )


# =========================================================
# AJUDA
# =========================================================

async def ajuda(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    mensagem = """
📚 *COMANDOS DO BOT*

📈 Cotação:

`/cotacao BBAS3`

➕ Compra:

`/comprar BBAS3 10 18.38`

➖ Venda:

`/vender BBAS3 5 20`

💵 Dividendo:

`/dividendo BBAS3 15.50`

💼 Carteira:

`/carteira`

📊 Resumo:

`/resumo`

💵 Todos os dividendos:

`/dividendos`

📰 Notícias:

`/noticias BBAS3`

📰 Notícias da carteira:

`/noticias`

🔔 Criar alerta:

`/alerta BBAS3 18`

🚨 Ver alertas:

`/alertas`

❌ Remover alerta:

`/removeralerta 1`

🇧🇷 Ibovespa:

`/ibov`

📋 Histórico:

`/historico`
"""

    await update.message.reply_text(
        mensagem,
        parse_mode="Markdown"
    )


# =========================================================
# COTAÇÃO
# =========================================================

async def cotacao(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    texto = update.message.text.strip()

    partes = texto.split()

    if len(partes) < 2:

        await update.message.reply_text(
            "❌ Informe o ativo.\n\n"
            "Exemplo:\n"
            "/cotacao BBAS3"
        )

        return

    ticker = partes[1].upper()

    ativo = await buscar_cotacao(
        ticker
    )

    if not ativo:

        await update.message.reply_text(
            f"❌ Não encontrei {ticker}."
        )

        return

    nome = ativo.get(
        "longName",
        ticker
    )

    preco = ativo.get(
        "regularMarketPrice",
        0
    )

    variacao = ativo.get(
        "regularMarketChangePercent",
        0
    )

    maxima = ativo.get(
        "regularMarketDayHigh",
        0
    )

    minima = ativo.get(
        "regularMarketDayLow",
        0
    )

    emoji = "🟢" if variacao >= 0 else "🔴"

    mensagem = (
        f"📊 *{ticker}*\n\n"
        f"🏢 {nome}\n\n"
        f"💰 Preço: {dinheiro(preco)}\n"
        f"{emoji} Hoje: {percentual(variacao)}\n"
        f"🔺 Máxima: {dinheiro(maxima)}\n"
        f"🔻 Mínima: {dinheiro(minima)}"
    )

    await update.message.reply_text(
        mensagem,
        parse_mode="Markdown"
    )


# =========================================================
# COMPRAR
# =========================================================

async def comprar(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    if len(context.args) != 3:

        await update.message.reply_text(
            "❌ Use:\n"
            "/comprar BBAS3 10 18.38"
        )

        return

    ticker = context.args[0].upper()

    try:

        quantidade = float(
            context.args[1].replace(",", ".")
        )

        preco = float(
            context.args[2].replace(",", ".")
        )

    except ValueError:

        await update.message.reply_text(
            "❌ Valores inválidos."
        )

        return

    if quantidade <= 0 or preco <= 0:

        await update.message.reply_text(
            "❌ Os valores precisam ser maiores que zero."
        )

        return

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        SELECT quantidade, preco_medio
        FROM ativos
        WHERE ticker = ?
        """,
        (ticker,)
    )

    resultado = cursor.fetchone()

    if resultado:

        qtd_antiga = resultado[0]
        medio_antigo = resultado[1]

        qtd_total = (
            qtd_antiga + quantidade
        )

        novo_medio = (
            (
                qtd_antiga
                * medio_antigo
            )
            +
            (
                quantidade
                * preco
            )
        ) / qtd_total

        cursor.execute(
            """
            UPDATE ativos
            SET quantidade = ?,
                preco_medio = ?
            WHERE ticker = ?
            """,
            (
                qtd_total,
                novo_medio,
                ticker
            )
        )

    else:

        qtd_total = quantidade
        novo_medio = preco

        cursor.execute(
            """
            INSERT INTO ativos
            (
                ticker,
                quantidade,
                preco_medio
            )
            VALUES (?, ?, ?)
            """,
            (
                ticker,
                quantidade,
                preco
            )
        )

    data = datetime.now(
        FUSO
    ).strftime(
        "%d/%m/%Y %H:%M"
    )

    cursor.execute(
        """
        INSERT INTO transacoes
        (
            ticker,
            tipo,
            quantidade,
            preco,
            data
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            ticker,
            "COMPRA",
            quantidade,
            preco,
            data
        )
    )

    conexao.commit()
    conexao.close()

    total = quantidade * preco

    await update.message.reply_text(
        "✅ *COMPRA REGISTRADA*\n\n"
        f"📊 {ticker}\n"
        f"📦 Quantidade: {numero(quantidade)}\n"
        f"💰 Preço: {dinheiro(preco)}\n"
        f"💵 Total: {dinheiro(total)}\n\n"
        f"📦 Total: {numero(qtd_total)}\n"
        f"📌 Preço médio: {dinheiro(novo_medio)}",
        parse_mode="Markdown"
    )


# =========================================================
# VENDER
# =========================================================

async def vender(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    if len(context.args) != 3:

        await update.message.reply_text(
            "❌ Use:\n"
            "/vender BBAS3 5 20"
        )

        return

    ticker = context.args[0].upper()

    try:

        quantidade = float(
            context.args[1].replace(",", ".")
        )

        preco = float(
            context.args[2].replace(",", ".")
        )

    except ValueError:

        await update.message.reply_text(
            "❌ Valores inválidos."
        )

        return

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        SELECT quantidade, preco_medio
        FROM ativos
        WHERE ticker = ?
        """,
        (ticker,)
    )

    resultado = cursor.fetchone()

    if not resultado:

        conexao.close()

        await update.message.reply_text(
            f"❌ Você não possui {ticker}."
        )

        return

    qtd_atual = resultado[0]
    medio = resultado[1]

    if quantidade > qtd_atual:

        conexao.close()

        await update.message.reply_text(
            f"❌ Você possui somente "
            f"{numero(qtd_atual)} {ticker}."
        )

        return

    nova_qtd = qtd_atual - quantidade

    if nova_qtd == 0:

        cursor.execute(
            """
            DELETE FROM ativos
            WHERE ticker = ?
            """,
            (ticker,)
        )

    else:

        cursor.execute(
            """
            UPDATE ativos
            SET quantidade = ?
            WHERE ticker = ?
            """,
            (
                nova_qtd,
                ticker
            )
        )

    lucro = (
        preco - medio
    ) * quantidade

    data = datetime.now(
        FUSO
    ).strftime(
        "%d/%m/%Y %H:%M"
    )

    cursor.execute(
        """
        INSERT INTO transacoes
        (
            ticker,
            tipo,
            quantidade,
            preco,
            data
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            ticker,
            "VENDA",
            quantidade,
            preco,
            data
        )
    )

    conexao.commit()
    conexao.close()

    emoji = "🟢" if lucro >= 0 else "🔴"

    await update.message.reply_text(
        "✅ *VENDA REGISTRADA*\n\n"
        f"📊 {ticker}\n"
        f"📦 Quantidade: {numero(quantidade)}\n"
        f"💰 Preço: {dinheiro(preco)}\n"
        f"{emoji} Resultado: {dinheiro(lucro)}",
        parse_mode="Markdown"
    )


# =========================================================
# DIVIDENDO
# =========================================================

async def dividendo(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    if len(context.args) != 2:

        await update.message.reply_text(
            "❌ Use:\n"
            "/dividendo BBAS3 15.50"
        )

        return

    ticker = context.args[0].upper()

    try:

        valor = float(
            context.args[1].replace(",", ".")
        )

    except ValueError:

        await update.message.reply_text(
            "❌ Valor inválido."
        )

        return

    data = datetime.now(
        FUSO
    ).strftime(
        "%d/%m/%Y"
    )

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        INSERT INTO dividendos
        (
            ticker,
            valor,
            data
        )
        VALUES (?, ?, ?)
        """,
        (
            ticker,
            valor,
            data
        )
    )

    conexao.commit()
    conexao.close()

    await update.message.reply_text(
        "💵 *DIVIDENDO REGISTRADO*\n\n"
        f"📊 Ativo: {ticker}\n"
        f"💰 Valor: {dinheiro(valor)}\n"
        f"📅 Data: {data}",
        parse_mode="Markdown"
    )


# =========================================================
# DIVIDENDOS
# =========================================================

async def dividendos(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        SELECT
            ticker,
            SUM(valor)
        FROM dividendos
        GROUP BY ticker
        ORDER BY SUM(valor) DESC
        """
    )

    dados = cursor.fetchall()

    cursor.execute(
        """
        SELECT COALESCE(SUM(valor), 0)
        FROM dividendos
        """
    )

    total = cursor.fetchone()[0]

    conexao.close()

    if not dados:

        await update.message.reply_text(
            "💵 Você ainda não registrou dividendos."
        )

        return

    mensagem = "💵 *DIVIDENDOS*\n\n"

    for ticker, valor in dados:

        mensagem += (
            f"📊 {ticker}: "
            f"*{dinheiro(valor)}*\n"
        )

    mensagem += (
        "\n━━━━━━━━━━━━━━\n"
        f"💰 *TOTAL: {dinheiro(total)}*"
    )

    await update.message.reply_text(
        mensagem,
        parse_mode="Markdown"
    )


# =========================================================
# CARTEIRA
# =========================================================

async def carteira(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        SELECT
            ticker,
            quantidade,
            preco_medio
        FROM ativos
        ORDER BY ticker
        """
    )

    ativos = cursor.fetchall()

    conexao.close()

    if not ativos:

        await update.message.reply_text(
            "📭 Sua carteira está vazia."
        )

        return

    mensagem = "💼 *MINHA CARTEIRA*\n\n"

    total_investido = 0
    total_atual = 0

    for ticker, quantidade, medio in ativos:

        ativo = await buscar_cotacao(
            ticker
        )

        if ativo:

            atual = ativo.get(
                "regularMarketPrice",
                medio
            )

            variacao = ativo.get(
                "regularMarketChangePercent",
                0
            )

        else:

            atual = medio
            variacao = 0

        investido = quantidade * medio
        valor_atual = quantidade * atual
        lucro = valor_atual - investido

        total_investido += investido
        total_atual += valor_atual

        emoji = "🟢" if lucro >= 0 else "🔴"

        mensagem += (
            f"*{ticker}*\n"
            f"📦 Qtd: {numero(quantidade)}\n"
            f"📌 Médio: {dinheiro(medio)}\n"
            f"💰 Atual: {dinheiro(atual)}\n"
            f"{emoji} Resultado: {dinheiro(lucro)}\n"
            f"📈 Hoje: {percentual(variacao)}\n\n"
        )

    lucro_total = (
        total_atual - total_investido
    )

    if total_investido:

        rentabilidade = (
            lucro_total
            / total_investido
        ) * 100

    else:

        rentabilidade = 0

    emoji = "🟢" if lucro_total >= 0 else "🔴"

    mensagem += (
        "━━━━━━━━━━━━━━\n"
        f"💵 Investido: {dinheiro(total_investido)}\n"
        f"💰 Patrimônio: {dinheiro(total_atual)}\n"
        f"{emoji} Resultado: {dinheiro(lucro_total)}\n"
        f"📈 Rentabilidade: {percentual(rentabilidade)}"
    )

    await update.message.reply_text(
        mensagem,
        parse_mode="Markdown"
    )


# =========================================================
# RESUMO
# =========================================================

async def resumo(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        SELECT
            ticker,
            quantidade,
            preco_medio
        FROM ativos
        """
    )

    ativos = cursor.fetchall()

    cursor.execute(
        """
        SELECT COALESCE(SUM(valor), 0)
        FROM dividendos
        """
    )

    total_dividendos = cursor.fetchone()[0]

    conexao.close()

    if not ativos:

        await update.message.reply_text(
            "📭 Sua carteira está vazia."
        )

        return

    investido = 0
    atual = 0

    for ticker, quantidade, medio in ativos:

        investido += quantidade * medio

        cotacao = await buscar_cotacao(
            ticker
        )

        if cotacao:

            preco = cotacao.get(
                "regularMarketPrice",
                medio
            )

        else:

            preco = medio

        atual += quantidade * preco

    lucro = atual - investido

    rentabilidade = (
        (lucro / investido) * 100
        if investido
        else 0
    )

    emoji = "🟢" if lucro >= 0 else "🔴"

    await update.message.reply_text(
        "📊 *RESUMO GERAL*\n\n"
        f"💵 Total investido:\n"
        f"*{dinheiro(investido)}*\n\n"
        f"💰 Patrimônio atual:\n"
        f"*{dinheiro(atual)}*\n\n"
        f"{emoji} Lucro/prejuízo:\n"
        f"*{dinheiro(lucro)}*\n\n"
        f"📈 Rentabilidade:\n"
        f"*{percentual(rentabilidade)}*\n\n"
        f"💵 Dividendos:\n"
        f"*{dinheiro(total_dividendos)}*",
        parse_mode="Markdown"
    )


# =========================================================
# ALERTA
# =========================================================

async def alerta(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    if len(context.args) != 2:

        await update.message.reply_text(
            "❌ Use:\n"
            "/alerta BBAS3 18"
        )

        return

    ticker = context.args[0].upper()

    try:

        preco = float(
            context.args[1].replace(",", ".")
        )

    except ValueError:

        await update.message.reply_text(
            "❌ Preço inválido."
        )

        return

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        INSERT INTO alertas
        (
            ticker,
            preco,
            ativo
        )
        VALUES (?, ?, 1)
        """,
        (
            ticker,
            preco
        )
    )

    id_alerta = cursor.lastrowid

    conexao.commit()
    conexao.close()

    await update.message.reply_text(
        "🔔 *ALERTA CRIADO*\n\n"
        f"ID: {id_alerta}\n"
        f"📊 Ativo: {ticker}\n"
        f"💰 Preço: {dinheiro(preco)}\n\n"
        "Você será avisado quando a cotação "
        "ficar abaixo ou igual ao valor definido.",
        parse_mode="Markdown"
    )


# =========================================================
# LISTAR ALERTAS
# =========================================================

async def alertas(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        SELECT id, ticker, preco
        FROM alertas
        WHERE ativo = 1
        ORDER BY id
        """
    )

    dados = cursor.fetchall()

    conexao.close()

    if not dados:

        await update.message.reply_text(
            "🔔 Você não possui alertas ativos."
        )

        return

    mensagem = "🔔 *MEUS ALERTAS*\n\n"

    for id_alerta, ticker, preco in dados:

        mensagem += (
            f"🆔 {id_alerta} — "
            f"*{ticker}* ≤ "
            f"{dinheiro(preco)}\n"
        )

    await update.message.reply_text(
        mensagem,
        parse_mode="Markdown"
    )


# =========================================================
# REMOVER ALERTA
# =========================================================

async def remover_alerta(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    if len(context.args) != 1:

        await update.message.reply_text(
            "❌ Use:\n"
            "/removeralerta 1"
        )

        return

    try:

        id_alerta = int(
            context.args[0]
        )

    except ValueError:

        await update.message.reply_text(
            "❌ ID inválido."
        )

        return

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        UPDATE alertas
        SET ativo = 0
        WHERE id = ?
        """,
        (id_alerta,)
    )

    conexao.commit()
    conexao.close()

    await update.message.reply_text(
        f"✅ Alerta {id_alerta} removido."
    )


# =========================================================
# IBOV
# =========================================================

async def ibov(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    ativo = await buscar_cotacao(
        "^BVSP"
    )

    if not ativo:

        await update.message.reply_text(
            "❌ Não consegui consultar o IBOV."
        )

        return

    preco = ativo.get(
        "regularMarketPrice",
        0
    )

    variacao = ativo.get(
        "regularMarketChangePercent",
        0
    )

    emoji = "🟢" if variacao >= 0 else "🔴"

    await update.message.reply_text(
        "🇧🇷 *IBOVESPA*\n\n"
        f"📊 Pontos: {preco:,.2f}\n"
        f"{emoji} Variação: "
        f"{percentual(variacao)}",
        parse_mode="Markdown"
    )


# =========================================================
# HISTÓRICO
# =========================================================

async def historico(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        SELECT
            ticker,
            tipo,
            quantidade,
            preco,
            data
        FROM transacoes
        ORDER BY id DESC
        LIMIT 15
        """
    )

    dados = cursor.fetchall()

    conexao.close()

    if not dados:

        await update.message.reply_text(
            "📋 Nenhuma transação registrada."
        )

        return

    mensagem = "📋 *HISTÓRICO*\n\n"

    for ticker, tipo, quantidade, preco, data in dados:

        emoji = (
            "🟢"
            if tipo == "COMPRA"
            else "🔴"
        )

        mensagem += (
            f"{emoji} *{tipo}* — {ticker}\n"
            f"📦 {numero(quantidade)} × "
            f"{dinheiro(preco)}\n"
            f"📅 {data}\n\n"
        )

    await update.message.reply_text(
        mensagem,
        parse_mode="Markdown"
    )


# =========================================================
# NOTÍCIAS DE UM ATIVO
# =========================================================

async def buscar_noticias(ticker):

    url = (
        "https://news.google.com/rss/search?"
        f"q={ticker}"
        "&hl=pt-BR"
        "&gl=BR"
        "&ceid=BR:pt-419"
    )

    try:

        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            resposta = await client.get(
                url
            )

        raiz = ET.fromstring(
            resposta.text
        )

        itens = raiz.findall(
            ".//item"
        )

        noticias_lista = []

        for item in itens[:5]:

            titulo = item.findtext(
                "title"
            )

            link = item.findtext(
                "link"
            )

            if titulo and link:

                noticias_lista.append(
                    (titulo, link)
                )

        return noticias_lista

    except Exception as erro:

        print(
            f"Erro notícias {ticker}: {erro}"
        )

        return []


# =========================================================
# NOTÍCIAS
# =========================================================

async def noticias(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    if context.args:

        tickers = [
            context.args[0].upper()
        ]

    else:

        conexao = conectar()
        cursor = conexao.cursor()

        cursor.execute(
            """
            SELECT ticker
            FROM ativos
            ORDER BY ticker
            """
        )

        tickers = [
            linha[0]
            for linha in cursor.fetchall()
        ]

        conexao.close()

    if not tickers:

        await update.message.reply_text(
            "📭 Sua carteira está vazia."
        )

        return

    mensagem = "📰 *NOTÍCIAS DA CARTEIRA*\n\n"

    for ticker in tickers:

        lista = await buscar_noticias(
            ticker
        )

        mensagem += (
            f"📊 *{ticker}*\n"
        )

        if not lista:

            mensagem += (
                "Nenhuma notícia encontrada.\n\n"
            )

            continue

        for titulo, link in lista[:3]:

            mensagem += (
                f"• [{titulo}]({link})\n"
            )

        mensagem += "\n"

    await update.message.reply_text(
        mensagem,
        parse_mode="Markdown"
    )


# =========================================================
# VERIFICAR ALERTAS
# =========================================================

async def verificar_alertas(
    application
):

    conexao = conectar()
    cursor = conexao.cursor()

    cursor.execute(
        """
        SELECT id, ticker, preco
        FROM alertas
        WHERE ativo = 1
        """
    )

    dados = cursor.fetchall()

    conexao.close()

    if not dados:
        return

    for id_alerta, ticker, limite in dados:

        ativo = await buscar_cotacao(
            ticker
        )

        if not ativo:
            continue

        preco_atual = ativo.get(
            "regularMarketPrice"
        )

        if preco_atual is None:
            continue

        if preco_atual <= limite:

            conexao = conectar()
            cursor = conexao.cursor()

            cursor.execute(
                """
                UPDATE alertas
                SET ativo = 0
                WHERE id = ?
                """,
                (id_alerta,)
            )

            conexao.commit()
            conexao.close()

            mensagem = (
                "🚨 *ALERTA DE PREÇO*\n\n"
                f"📊 Ativo: *{ticker}*\n"
                f"💰 Atual: *{dinheiro(preco_atual)}*\n"
                f"🎯 Limite: *{dinheiro(limite)}*"
            )

            # Envia para todos os chats que já
            # usaram /start nesta execução.
            for chat_id in CHATS:

                try:

                    await application.bot.send_message(
                        chat_id=chat_id,
                        text=mensagem,
                        parse_mode="Markdown"
                    )

                except Exception as erro:

                    print(
                        "Erro enviando alerta:",
                        erro
                    )


# =========================================================
# CHATS
# =========================================================

CHATS = set()


async def registrar_chat(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):

    if update.effective_chat:

        CHATS.add(
            update.effective_chat.id
        )


# =========================================================
# LOOP AUTOMÁTICO
# =========================================================

async def tarefas_automaticas(
    application
):

    while True:

        try:

            await verificar_alertas(
                application
            )

        except Exception as erro:

            print(
                "Erro no monitor:",
                erro
            )

        await asyncio.sleep(
            300
        )


# =========================================================
# ERROS
# =========================================================

async def erro(
    update,
    context: ContextTypes.DEFAULT_TYPE
):

    print(
        "Erro no bot:",
        context.error
    )


# =========================================================
# INICIALIZAÇÃO
# =========================================================

async def iniciar_monitor(
    application
):

    application.create_task(
        tarefas_automaticas(
            application
        )
    )


# =========================================================
# MAIN
# =========================================================

def main():

    criar_banco()

    app = (
        Application
        .builder()
        .token(TELEGRAM_TOKEN)
        .post_init(iniciar_monitor)
        .build()
    )

    app.add_handler(
        CommandHandler(
            "start",
            start
        )
    )

    app.add_handler(
        CommandHandler(
            "ajuda",
            ajuda
        )
    )

    app.add_handler(
        CommandHandler(
            "cotacao",
            cotacao
        )
    )

    app.add_handler(
        CommandHandler(
            "comprar",
            comprar
        )
    )

    app.add_handler(
        CommandHandler(
            "vender",
            vender
        )
    )

    app.add_handler(
        CommandHandler(
            "dividendo",
            dividendo
        )
    )

    app.add_handler(
        CommandHandler(
            "dividendos",
            dividendos
        )
    )

    app.add_handler(
        CommandHandler(
            "carteira",
            carteira
        )
    )

    app.add_handler(
        CommandHandler(
            "resumo",
            resumo
        )
    )

    app.add_handler(
        CommandHandler(
            "alerta",
            alerta
        )
    )

    app.add_handler(
        CommandHandler(
            "alertas",
            alertas
        )
    )

    app.add_handler(
        CommandHandler(
            "removeralerta",
            remover_alerta
        )
    )

    app.add_handler(
        CommandHandler(
            "ibov",
            ibov
        )
    )

    app.add_handler(
        CommandHandler(
            "historico",
            historico
        )
    )

    app.add_handler(
        CommandHandler(
            "noticias",
            noticias
        )
    )

    app.add_handler(
        CommandHandler(
            "start",
            registrar_chat
        ),
        group=1
    )

    app.add_error_handler(
        erro
    )

    print(
        "🤖 BOT DE INVESTIMENTOS V2 INICIADO!"
    )

    app.run_polling()


# =========================================================
# EXECUTAR
# =========================================================

if __name__ == "__main__":
    main()