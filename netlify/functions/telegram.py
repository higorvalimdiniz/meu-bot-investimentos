import os
import json
import urllib.request
import urllib.parse

BOT_TOKEN = os.environ.get("TELEGRAM_TOKEN")


def telegram(method, data=None):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"

    if data:
        encoded = urllib.parse.urlencode(data).encode("utf-8")

        request = urllib.request.Request(
            url,
            data=encoded,
            method="POST"
        )

        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))

    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode("utf-8"))


def enviar_mensagem(chat_id, texto):
    return telegram(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": texto,
            "parse_mode": "HTML"
        }
    )


def handler(event, context):

    try:

        if event.get("httpMethod") != "POST":
            return {
                "statusCode": 200,
                "body": "Bot de investimentos online!"
            }

        body = event.get("body")

        if not body:
            return {
                "statusCode": 200,
                "body": "OK"
            }

        update = json.loads(body)

        message = update.get("message")

        if not message:
            return {
                "statusCode": 200,
                "body": "OK"
            }

        chat_id = message["chat"]["id"]

        texto = message.get("text", "").strip()

        if texto == "/start":

            resposta = """
<b>📊 MEU BOT DE INVESTIMENTOS</b>

Bem-vindo!

<b>💰 COTAÇÃO</b>
/cotacao BBAS3

<b>📊 CARTEIRA</b>
/carteira

<b>🛒 COMPRAR</b>
/comprar BBAS3 10 18.38

<b>💵 VENDER</b>
/vender BBAS3 5 20

<b>💰 DIVIDENDO</b>
/dividendo BBAS3 15.50

<b>📰 NOTÍCIAS</b>
/noticias BBAS3

<b>📈 RESUMO</b>
/resumo

<b>❓ AJUDA</b>
/ajuda
"""

        elif texto == "/ajuda":

            resposta = """
<b>🤖 COMANDOS</b>

📈 /cotacao BBAS3

📊 /carteira

🛒 /comprar BBAS3 10 18.38

💵 /vender BBAS3 5 20

💰 /dividendo BBAS3 15.50

📰 /noticias BBAS3

📊 /resumo
"""

        else:

            resposta = (
                "🤖 Comando recebido!\n\n"
                f"<code>{texto}</code>\n\n"
                "Estou processando seu pedido."
            )

        enviar_mensagem(chat_id, resposta)

        return {
            "statusCode": 200,
            "body": "OK"
        }

    except Exception as e:

        print("ERRO:", str(e))

        return {
            "statusCode": 500,
            "body": "Erro interno"
        }
