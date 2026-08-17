import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
BRAPI_TOKEN = os.getenv("BRAPI_TOKEN")

# Configurações gerais do bot
BOT_NAME = "Meu Bot Investimentos"
BOT_VERSION = "1.0.0"
